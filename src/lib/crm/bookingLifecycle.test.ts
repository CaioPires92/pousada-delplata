import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { booking: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/crm/pipelineCards", () => ({ updatePipelineCard: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));
vi.mock("@/lib/crm/followUpCancellation", () => ({ cancelCommercialFollowUps: vi.fn() }));

import prisma from "@/lib/prisma";
import { publishBookingLifecycleEvent } from "@/lib/crm/bookingLifecycle";
import { recordCrmEvent } from "@/lib/crm/events";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { cancelCommercialFollowUps } from "@/lib/crm/followUpCancellation";

describe("publishBookingLifecycleEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updatePipelineCard).mockResolvedValue({
      ok: true,
      card: { id: "card-1" } as never,
      stageChanged: true,
    });
    vi.mocked(recordCrmEvent).mockResolvedValue({ id: "event-1" } as never);
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
});
