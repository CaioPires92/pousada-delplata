import prisma from "@/lib/prisma";
import { buildAuditMetadata, type AuditActorType, type AuditOrigin } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";
import { updatePipelineCard } from "@/lib/crm/pipelineCards";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/crm/pipelineStages";
import { crmLog } from "@/lib/crm/logger";
import { claimCrmEvent, completeCrmEvent, releaseCrmEvent } from "@/lib/crm/eventIdempotency";
import { cancelCommercialFollowUps } from "@/lib/crm/followUpCancellation";

export type BookingLifecycleEvent =
  | "ReservationStarted"
  | "PaymentPending"
  | "PaymentApproved"
  | "BookingConfirmed"
  | "CheckoutConfirmed";

const COMMERCIAL_CANCELLATION_EVENTS: readonly BookingLifecycleEvent[] = [
  "ReservationStarted",
  "PaymentPending",
  "PaymentApproved",
  "BookingConfirmed",
];

const TARGET_STAGE: Partial<Record<BookingLifecycleEvent, PipelineStage>> = {
  ReservationStarted: PIPELINE_STAGES.RESERVA_EM_ANDAMENTO,
  PaymentPending: PIPELINE_STAGES.PAGAMENTO_PENDENTE,
  PaymentApproved: PIPELINE_STAGES.RESERVA_CONFIRMADA,
  BookingConfirmed: PIPELINE_STAGES.RESERVA_CONFIRMADA,
  CheckoutConfirmed: PIPELINE_STAGES.POS_VENDA,
};

export async function publishBookingLifecycleEvent(input: {
  bookingId: string;
  event: BookingLifecycleEvent;
  actorType?: AuditActorType;
  origin?: AuditOrigin;
  reason?: string;
  metadata?: Record<string, unknown>;
  eventId?: string;
}) {
  let claimedEventId: string | null = null;
  try {
    if (input.eventId) {
      const claim = await claimCrmEvent({
        eventId: input.eventId,
        source: input.origin ?? "system",
        eventType: input.event,
      });
      if (!claim.claimed) {
        return { ok: true as const, duplicate: true as const, pipelineUpdated: false };
      }
      claimedEventId = input.eventId;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        crmContactId: true,
        crmConversationId: true,
        pipelineCard: { select: { id: true, stage: true } },
      },
    });

    if (!booking) {
      if (claimedEventId) await releaseCrmEvent(claimedEventId);
      return { ok: false as const, reason: "booking_not_found" as const };
    }

    if (
      COMMERCIAL_CANCELLATION_EVENTS.includes(input.event)
      && booking.crmContactId
      && booking.crmConversationId
    ) {
      await cancelCommercialFollowUps({
        conversationId: booking.crmConversationId,
        contactId: booking.crmContactId,
        reason: "reservation_started",
        origin: input.origin ?? "system",
      });
    }

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

    const result = {
      ok: true as const,
      duplicate: false as const,
      pipelineUpdated,
      pipelineError,
      pipelineCardId: booking.pipelineCard?.id ?? null,
    };
    if (claimedEventId) await completeCrmEvent(claimedEventId, result);
    return result;
  } catch (error) {
    if (claimedEventId) await releaseCrmEvent(claimedEventId).catch(() => undefined);
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

export function publishBookingCheckoutConfirmed(input: {
  bookingId: string;
  checkoutAt: Date;
  metadata?: Record<string, unknown>;
}) {
  return publishBookingLifecycleEvent({
    bookingId: input.bookingId,
    event: "CheckoutConfirmed",
    eventId: `booking:${input.bookingId}:checkout-confirmed`,
    actorType: "system",
    origin: "system",
    reason: "Check-out confirmado pelo domínio Booking",
    metadata: {
      source: "booking",
      checkoutAt: input.checkoutAt.toISOString(),
      ...input.metadata,
    },
  });
}
