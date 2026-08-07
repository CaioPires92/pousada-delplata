import prisma from "@/lib/prisma";
import { buildAuditMetadata, type AuditActorType, type AuditOrigin } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/crm/pipelineStages";
import { crmLog } from "@/lib/crm/logger";

export type BookingLifecycleEvent =
  | "ReservationStarted"
  | "PaymentPending"
  | "PaymentApproved"
  | "BookingConfirmed";

const TARGET_STAGE: Partial<Record<BookingLifecycleEvent, PipelineStage>> = {
  ReservationStarted: PIPELINE_STAGES.RESERVA_EM_ANDAMENTO,
  PaymentPending: PIPELINE_STAGES.PAGAMENTO_PENDENTE,
  PaymentApproved: PIPELINE_STAGES.RESERVA_CONFIRMADA,
  BookingConfirmed: PIPELINE_STAGES.RESERVA_CONFIRMADA,
};

export async function publishBookingLifecycleEvent(input: {
  bookingId: string;
  event: BookingLifecycleEvent;
  actorType?: AuditActorType;
  origin?: AuditOrigin;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        crmContactId: true,
        crmConversationId: true,
        pipelineCard: { select: { id: true, stage: true } },
      },
    });

    if (!booking) return { ok: false as const, reason: "booking_not_found" as const };

    const targetStage = TARGET_STAGE[input.event];
    let pipelineUpdated = false;
    let pipelineError: string | null = null;

    if (targetStage && booking.pipelineCard) {
      const update = await updatePipelineCard(booking.pipelineCard.id, {
        stage: targetStage,
        reason: input.reason ?? `Evento confiável: ${input.event}`,
        actorType: input.actorType === "n8n" ? "n8n" : input.actorType === "human" ? "human" : "system",
      });
      pipelineUpdated = update.ok;
      pipelineError = update.ok ? null : update.error;
    }

    await recordCrmEvent({
      action: input.event,
      bookingId: booking.id,
      contactId: booking.crmContactId ?? undefined,
      conversationId: booking.crmConversationId ?? undefined,
      metadata: {
        pipelineCardId: booking.pipelineCard?.id ?? null,
        targetStage: targetStage ?? null,
        pipelineUpdated,
        pipelineError,
        ...input.metadata,
        ...buildAuditMetadata({
          actorType: input.actorType ?? "system",
          origin: input.origin ?? "system",
          reason: input.reason ?? null,
        }),
      },
    });

    return {
      ok: true as const,
      pipelineUpdated,
      pipelineError,
      pipelineCardId: booking.pipelineCard?.id ?? null,
    };
  } catch (error) {
    crmLog({
      level: "ERROR",
      action: input.event,
      message: "Failed to publish booking lifecycle event",
      context: {
        bookingId: input.bookingId,
        errorCode: error instanceof Error ? error.message.slice(0, 100) : "unknown_error",
      },
    });
    return { ok: false as const, reason: "lifecycle_publish_failed" as const };
  }
}
