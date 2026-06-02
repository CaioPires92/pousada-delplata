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

    // Após registrar no banco, emitimos para sistemas externos (n8n)
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
 * Emite o evento para sistemas externos (n8n, Webhooks, etc).
 * Por enquanto é um placeholder para futura integração.
 */
export async function emitCrmEvent(input: CrmEventInput) {
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  
  if (!n8nUrl) {
    // Silently skip if no URL is configured
    return;
  }

  try {
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        ...input,
      }),
    });

    if (!response.ok) {
      crmLog({
        level: "WARN",
        action: input.action,
        message: "n8n responded with non-success status",
        context: { status: response.status },
      });
    }
  } catch (error) {
    crmLog({
      level: "ERROR",
      action: input.action,
      message: "Failed to emit CRM event to n8n",
      context: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    try {
      await prisma.internalActionLog.create({
        data: {
          action: "N8NEmitFailed",
          contactId: input.contactId,
          conversationId: input.conversationId,
          bookingId: input.bookingId,
          userId: input.userId,
          metadataJson: JSON.stringify({
            originalAction: input.action,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      });
    } catch {
      // noop
    }
  }
}
