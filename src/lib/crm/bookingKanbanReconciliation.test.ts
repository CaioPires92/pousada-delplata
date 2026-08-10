import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: { findMany: vi.fn(), findUnique: vi.fn() },
    pipelineCard: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/crm/bookingCrmLink", () => ({ reconcileBookingToCrm: vi.fn() }));
vi.mock("@/lib/crm/followUpCancellation", () => ({ cancelCommercialFollowUps: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { reconcileBookingToCrm } from "@/lib/crm/bookingCrmLink";
import { cancelCommercialFollowUps } from "@/lib/crm/followUpCancellation";
import { recordCrmEvent } from "@/lib/crm/events";
import {
  reconcileBookingsWithKanban,
  resolveBookingPipelineStage,
} from "@/lib/crm/bookingKanbanReconciliation";

const linkedBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-1",
  status: "CONFIRMED",
  crmContactId: "contact-1",
  crmConversationId: "conversation-1",
  guest: { email: "guest@example.com", phone: "5511999999999" },
  payment: { status: "APPROVED" },
  pipelineCard: { id: "card-1", stage: "PERDIDO" },
  ...overrides,
});

describe("booking/Kanban reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.booking.findMany).mockResolvedValue([{ id: "booking-1" }] as never);
    vi.mocked(prisma.pipelineCard.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(cancelCommercialFollowUps).mockResolvedValue({ cards: 0, queueJobs: 0 });
    vi.mocked(recordCrmEvent).mockResolvedValue(null);
  });

  it("derives stages only from authoritative booking and payment states", () => {
    expect(resolveBookingPipelineStage({ status: "CONFIRMED" })).toBe("RESERVA_CONFIRMADA");
    expect(resolveBookingPipelineStage({ status: "PENDING", paymentStatus: "PENDING" })).toBe("PAGAMENTO_PENDENTE");
    expect(resolveBookingPipelineStage({ status: "PENDING" })).toBe("RESERVA_EM_ANDAMENTO");
    expect(resolveBookingPipelineStage({ status: "CANCELLED" })).toBeNull();
  });

  it("recovers a confirmed booking that was incorrectly left as lost", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(linkedBooking() as never);

    await expect(reconcileBookingsWithKanban()).resolves.toMatchObject({
      scanned: 1,
      stageUpdated: 1,
      failed: 0,
    });
    expect(prisma.pipelineCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "card-1", stage: "PERDIDO" },
      data: expect.objectContaining({
        stage: "RESERVA_CONFIRMADA",
        lossReason: null,
        lostReason: null,
      }),
    }));
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "BookingKanbanReconciled",
      bookingId: "booking-1",
    }));
  });

  it("links an unlinked booking before reconciling its stage", async () => {
    vi.mocked(prisma.booking.findUnique)
      .mockResolvedValueOnce(linkedBooking({
        status: "PENDING",
        payment: null,
        crmContactId: null,
        crmConversationId: null,
        pipelineCard: null,
      }) as never)
      .mockResolvedValueOnce(linkedBooking({
        status: "PENDING",
        payment: null,
        pipelineCard: { id: "card-1", stage: "ORCAMENTO_ENVIADO" },
      }) as never);
    vi.mocked(reconcileBookingToCrm).mockResolvedValue({
      ok: true,
      linked: true,
      bookingId: "booking-1",
      contactId: "contact-1",
      conversationId: "conversation-1",
      pipelineCardId: "card-1",
    });

    await expect(reconcileBookingsWithKanban()).resolves.toMatchObject({
      linked: 1,
      stageUpdated: 1,
    });
    expect(reconcileBookingToCrm).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: "booking-1",
    }));
    expect(prisma.pipelineCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stage: "RESERVA_EM_ANDAMENTO" }),
    }));
  });

  it("never regresses a card that already advanced beyond confirmation", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(linkedBooking({
      pipelineCard: { id: "card-1", stage: "HOSPEDADO" },
    }) as never);

    await expect(reconcileBookingsWithKanban()).resolves.toMatchObject({
      unchanged: 1,
      stageUpdated: 0,
    });
    expect(prisma.pipelineCard.updateMany).not.toHaveBeenCalled();
  });

  it("does not duplicate history when another worker wins the same repair", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(linkedBooking() as never);
    vi.mocked(prisma.pipelineCard.updateMany).mockResolvedValue({ count: 0 });

    await expect(reconcileBookingsWithKanban()).resolves.toMatchObject({
      unchanged: 1,
      stageUpdated: 0,
    });
    expect(recordCrmEvent).not.toHaveBeenCalled();
    expect(cancelCommercialFollowUps).not.toHaveBeenCalled();
  });
});
