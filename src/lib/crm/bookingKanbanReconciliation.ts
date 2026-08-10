import prisma from "@/lib/prisma";
import { buildAuditMetadata } from "@/lib/crm/audit";
import { reconcileBookingToCrm } from "@/lib/crm/bookingCrmLink";
import { cancelCommercialFollowUps } from "@/lib/crm/followUpCancellation";
import { recordCrmEvent } from "@/lib/crm/events";
import {
  PIPELINE_STAGE_ORDER,
  PIPELINE_STAGES,
  isPipelineStage,
  normalizePipelineStage,
  type PipelineStage,
} from "@/lib/crm/pipelineStages";

type ReconciliationBookingState = {
  status: string;
  paymentStatus?: string | null;
};

export function resolveBookingPipelineStage(
  booking: ReconciliationBookingState
): PipelineStage | null {
  const bookingStatus = booking.status.trim().toUpperCase();
  const paymentStatus = booking.paymentStatus?.trim().toUpperCase() ?? "";

  if (["CONFIRMED", "PAID"].includes(bookingStatus) || paymentStatus === "APPROVED") {
    return PIPELINE_STAGES.RESERVA_CONFIRMADA;
  }
  if (["PENDING", "IN_PROCESS", "AUTHORIZED"].includes(paymentStatus)) {
    return PIPELINE_STAGES.PAGAMENTO_PENDENTE;
  }
  if (["PENDING", "RESERVED"].includes(bookingStatus)) {
    return PIPELINE_STAGES.RESERVA_EM_ANDAMENTO;
  }

  return null;
}

function shouldMoveToTrustedStage(current: string, target: PipelineStage) {
  if (!isPipelineStage(current)) return false;
  const normalizedCurrent = normalizePipelineStage(current);
  if (normalizedCurrent === target) return false;

  // Uma confirmação real do motor/gateway recupera inclusive cards marcados
  // prematuramente como perdidos. Os demais estados nunca andam para trás.
  if (
    normalizedCurrent === PIPELINE_STAGES.PERDIDO &&
    target === PIPELINE_STAGES.RESERVA_CONFIRMADA
  ) {
    return true;
  }

  return (
    PIPELINE_STAGE_ORDER.indexOf(normalizedCurrent) <
    PIPELINE_STAGE_ORDER.indexOf(target)
  );
}

export async function reconcileBookingsWithKanban(options: { limit?: number } = {}) {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 100), 1), 500);
  const candidates = await prisma.booking.findMany({
    where: { status: { in: ["PENDING", "RESERVED", "CONFIRMED", "PAID"] } },
    select: { id: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
  });

  const summary = {
    scanned: candidates.length,
    linked: 0,
    stageUpdated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      let booking = await prisma.booking.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          status: true,
          crmContactId: true,
          crmConversationId: true,
          guest: { select: { email: true, phone: true } },
          payment: { select: { status: true } },
          pipelineCard: { select: { id: true, stage: true } },
        },
      });
      if (!booking) {
        summary.skipped += 1;
        continue;
      }

      if (!booking.crmContactId || !booking.crmConversationId || !booking.pipelineCard) {
        const link = await reconcileBookingToCrm({
          bookingId: booking.id,
          guestEmail: booking.guest.email,
          guestPhone: booking.guest.phone,
        });
        if (link.ok && link.linked) summary.linked += 1;

        booking = await prisma.booking.findUnique({
          where: { id: candidate.id },
          select: {
            id: true,
            status: true,
            crmContactId: true,
            crmConversationId: true,
            guest: { select: { email: true, phone: true } },
            payment: { select: { status: true } },
            pipelineCard: { select: { id: true, stage: true } },
          },
        });
      }

      if (!booking?.crmContactId || !booking.crmConversationId || !booking.pipelineCard) {
        summary.skipped += 1;
        continue;
      }

      const targetStage = resolveBookingPipelineStage({
        status: booking.status,
        paymentStatus: booking.payment?.status,
      });
      if (!targetStage) {
        summary.skipped += 1;
        continue;
      }

      if (!shouldMoveToTrustedStage(booking.pipelineCard.stage, targetStage)) {
        summary.unchanged += 1;
        continue;
      }

      const previousStage = normalizePipelineStage(booking.pipelineCard.stage);
      const updated = await prisma.pipelineCard.updateMany({
        where: { id: booking.pipelineCard.id, stage: booking.pipelineCard.stage },
        data: {
          stage: targetStage,
          lastActivityAt: new Date(),
          ...(previousStage === PIPELINE_STAGES.PERDIDO
            ? { lossReason: null, lostReason: null }
            : {}),
        },
      });
      if (updated.count === 0) {
        summary.unchanged += 1;
        continue;
      }
      await cancelCommercialFollowUps({
        conversationId: booking.crmConversationId,
        contactId: booking.crmContactId,
        reason: "reservation_started",
        origin: "system",
      });
      await recordCrmEvent({
        action: "BookingKanbanReconciled",
        bookingId: booking.id,
        contactId: booking.crmContactId,
        conversationId: booking.crmConversationId,
        metadata: {
          pipelineCardId: booking.pipelineCard.id,
          previousStage,
          targetStage,
          ...buildAuditMetadata({
            actorType: "system",
            origin: "system",
            reason: "Reconciliação periódica com o estado confiável da reserva",
          }),
        },
      });
      summary.stageUpdated += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
