import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { booking: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/crm/pipelineCards", () => ({ updatePipelineCard: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));
vi.mock("@/lib/crm/followUpCancellation", () => ({ cancelCommercialFollowUps: vi.fn() }));
vi.mock("@/lib/crm/eventIdempotency", () => ({
  claimCrmEvent: vi.fn(),
  completeCrmEvent: vi.fn(),
  releaseCrmEvent: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { publishBookingCheckoutConfirmed, publishBookingLifecycleEvent } from "@/lib/crm/bookingLifecycle";
import { recordCrmEvent } from "@/lib/crm/events";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { cancelCommercialFollowUps } from "@/lib/crm/followUpCancellation";
import { claimCrmEvent, completeCrmEvent } from "@/lib/crm/eventIdempotency";

describe("publishBookingLifecycleEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updatePipelineCard).mockResolvedValue({
      ok: true,
      card: { id: "card-1" } as never,
      stageChanged: true,
    });
    vi.mocked(recordCrmEvent).mockResolvedValue({ id: "event-1" } as never);
    vi.mocked(claimCrmEvent).mockResolvedValue({ claimed: true });
    vi.mocked(completeCrmEvent).mockResolvedValue({} as never);
  });

  it("moves the linked card and records a correlated payment event", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-1",
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      pipelineCard: { id: "card-1", stage: "RESERVA_EM_ANDAMENTO" },
    } as never);

    await expect(publishBookingLifecycleEvent({
      bookingId: "booking-1",
      event: "PaymentPending",
      origin: "webhook",
      actorType: "webhook",
      metadata: { provider: "MERCADOPAGO" },
    })).resolves.toMatchObject({ ok: true, pipelineUpdated: true, pipelineCardId: "card-1" });

    expect(updatePipelineCard).toHaveBeenCalledWith("card-1", expect.objectContaining({
      stage: "PAGAMENTO_PENDENTE",
      actorType: "system",
    }));
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "PaymentPending",
      bookingId: "booking-1",
      contactId: "contact-1",
      conversationId: "conversation-1",
      metadata: expect.objectContaining({ provider: "MERCADOPAGO", pipelineUpdated: true }),
    }));
  });

  it("records the authoritative event even when the booking has no CRM link", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-2",
      crmContactId: null,
      crmConversationId: null,
      pipelineCard: null,
    } as never);

    await expect(publishBookingLifecycleEvent({
      bookingId: "booking-2",
      event: "BookingConfirmed",
    })).resolves.toMatchObject({ ok: true, pipelineUpdated: false, pipelineCardId: null });

    expect(updatePipelineCard).not.toHaveBeenCalled();
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "BookingConfirmed",
      bookingId: "booking-2",
    }));
  });

  it("cancels remaining commercial follow-ups when a reservation starts", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-3",
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      pipelineCard: { id: "card-1", stage: "ORCAMENTO_ENVIADO" },
    } as never);
    vi.mocked(cancelCommercialFollowUps).mockResolvedValue({ cards: 1, queueJobs: 1 });

    await publishBookingLifecycleEvent({
      bookingId: "booking-3",
      event: "ReservationStarted",
      origin: "system",
    });

    expect(cancelCommercialFollowUps).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      contactId: "contact-1",
      reason: "reservation_started",
      origin: "system",
    });
  });

  it("also cancels follow-ups when confirmation arrives without intermediate events", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-confirmed-directly",
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      pipelineCard: { id: "card-1", stage: "PAGAMENTO_PENDENTE" },
    } as never);
    vi.mocked(updatePipelineCard).mockResolvedValue({
      ok: true,
      card: { id: "card-1" },
      stageChanged: true,
    } as never);
    vi.mocked(cancelCommercialFollowUps).mockResolvedValue({ cards: 0, queueJobs: 1 });

    await publishBookingLifecycleEvent({
      bookingId: "booking-confirmed-directly",
      event: "BookingConfirmed",
      origin: "webhook",
    });

    expect(cancelCommercialFollowUps).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conversation-1",
      contactId: "contact-1",
      reason: "reservation_started",
    }));
  });

  it("does not invent an event for a missing booking", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

    await expect(publishBookingLifecycleEvent({
      bookingId: "missing",
      event: "PaymentApproved",
    })).resolves.toEqual({ ok: false, reason: "booking_not_found" });
    expect(recordCrmEvent).not.toHaveBeenCalled();
  });

  it("fails safely without breaking the booking or payment endpoint", async () => {
    vi.mocked(prisma.booking.findUnique).mockRejectedValue(new Error("database unavailable"));

    await expect(publishBookingLifecycleEvent({
      bookingId: "booking-3",
      event: "PaymentPending",
    })).resolves.toEqual({ ok: false, reason: "lifecycle_publish_failed" });
  });

  it("publishes one authoritative checkout event with a stable id per booking", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-checkout",
      crmContactId: "contact-1",
      crmConversationId: "conversation-1",
      pipelineCard: { id: "card-1", stage: "RESERVA_CONFIRMADA" },
    } as never);

    await expect(publishBookingCheckoutConfirmed({
      bookingId: "booking-checkout",
      checkoutAt: new Date("2026-08-11T15:00:00.000Z"),
    })).resolves.toMatchObject({ ok: true, duplicate: false });

    expect(claimCrmEvent).toHaveBeenCalledWith({
      eventId: "booking:booking-checkout:checkout-confirmed",
      source: "system",
      eventType: "CheckoutConfirmed",
    });
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "CheckoutConfirmed",
      bookingId: "booking-checkout",
      metadata: expect.objectContaining({
        source: "booking",
        checkoutAt: "2026-08-11T15:00:00.000Z",
      }),
    }));
    expect(updatePipelineCard).toHaveBeenCalledWith("card-1", expect.objectContaining({
      stage: "POS_VENDA",
      actorType: "system",
    }));
    expect(cancelCommercialFollowUps).not.toHaveBeenCalled();
  });

  it("does not publish checkout twice when its stable event id was already claimed", async () => {
    vi.mocked(claimCrmEvent).mockResolvedValue({
      claimed: false,
      receipt: { status: "completed", resultJson: null, completedAt: new Date() },
    });

    await expect(publishBookingCheckoutConfirmed({
      bookingId: "booking-checkout",
      checkoutAt: new Date("2026-08-11T15:00:00.000Z"),
    })).resolves.toEqual({ ok: true, duplicate: true, pipelineUpdated: false });

    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    expect(recordCrmEvent).not.toHaveBeenCalled();
  });
});
