import prisma from "@/lib/prisma";
import { crmLog } from "@/lib/crm/logger";
import { enqueueAutomationJob } from "@/lib/crm/automationQueue";
import { buildN8nEventEnvelope } from "@/lib/crm/n8nEventContract";
import { getN8nDeliveryConfig } from "@/lib/crm/n8nDelivery";

export interface CrmEventInput {
  action: string;
  correlationId?: string;
  causationId?: string;
  contactId?: string;
  conversationId?: string;
  bookingId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Registra um evento interno no log do CRM.
 * Este é o sistema de registro (System of Record).
 */
export async function recordCrmEvent(input: CrmEventInput) {
  try {
    const log = await prisma.internalActionLog.create({
      data: {
        action: input.action,
        contactId: input.contactId,
        conversationId: input.conversationId,
        bookingId: input.bookingId,
        userId: input.userId,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    await emitCrmEvent(input, log.id, "createdAt" in log && log.createdAt ? log.createdAt : new Date());
    crmLog({
      level: "AUTOMATION",
      action: input.action,
      message: "CRM event recorded",
      context: {
        contactId: input.contactId,
        conversationId: input.conversationId,
      },
    });

    return log;
  } catch (error) {
    crmLog({
      level: "ERROR",
      action: input.action,
      message: "Failed to record CRM event",
      context: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    // Não lançamos erro para não quebrar o fluxo principal (atendimento)
    return null;
  }
}

/**
 * Emite eventos do CRM para um Webhook externo (n8n).
 */
export async function emitCrmEvent(
  input: CrmEventInput,
  eventId: string,
  occurredAt: Date | string = new Date()
) {
  if (process.env.NODE_ENV === "test" || process.env.N8N_ENABLED !== "true") {
    crmLog({
      level: "INFO",
      action: input.action,
      message: "External CRM event emission skipped",
      context: {
        reason: process.env.NODE_ENV === "test"
          ? "test_environment"
          : "disabled",
      },
    });
    return { queued: false as const };
  }

  try {
    getN8nDeliveryConfig();
    if (!input.conversationId) return { queued: false as const, reason: "missing_conversation" as const };
    const envelope = buildN8nEventEnvelope({ eventId, occurredAt, event: input });
    if (!envelope) return { queued: false as const, reason: "event_not_allowed" as const };

    const job = await enqueueAutomationJob({
      conversationId: input.conversationId,
      action: "EMIT_N8N_EVENT",
      payload: { event: envelope },
    });

    crmLog({
      level: "INFO",
      action: input.action,
      message: "External CRM event queued",
      context: { eventId, queueJobId: job.id },
    });
    return { queued: true as const, jobId: job.id };
  } catch (error) {
    crmLog({
      level: "ERROR",
      action: input.action,
      message: "Failed to queue external CRM event",
      context: { errorCode: error instanceof Error ? error.message.slice(0, 100) : "unknown_error" },
    });
    return { queued: false as const, reason: "queue_failed" as const };
  }
}
