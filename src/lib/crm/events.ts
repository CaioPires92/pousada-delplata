import prisma from "@/lib/prisma";
import { crmLog } from "@/lib/crm/logger";

export interface CrmEventInput {
  action: string;
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

    // O CRM continua registrando eventos localmente.
    // A emissão externa está desativada enquanto o n8n é reconstruído do zero.
    await emitCrmEvent(input);
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
export async function emitCrmEvent(input: CrmEventInput) {
  const externalEmissionEnabled = process.env.N8N_ENABLED === "true";
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (process.env.NODE_ENV === "test" || !externalEmissionEnabled || !webhookUrl) {
    crmLog({
      level: "INFO",
      action: input.action,
      message: "External CRM event emission skipped",
      context: {
        reason: process.env.NODE_ENV === "test"
          ? "test_environment"
          : !externalEmissionEnabled
            ? "disabled"
            : "webhook_not_configured",
      },
    });
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: input.action,
        timestamp: new Date().toISOString(),
        payload: {
          contactId: input.contactId,
          conversationId: input.conversationId,
          bookingId: input.bookingId,
          userId: input.userId,
          metadata: input.metadata,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    crmLog({
      level: "INFO",
      action: input.action,
      message: "Emitted CRM event to external webhook successfully",
    });
  } catch (error) {
    crmLog({
      level: "ERROR",
      action: input.action,
      message: "Failed to emit external CRM event",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
