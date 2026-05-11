import prisma from "@/lib/prisma";

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

    return log;
  } catch (error) {
    console.error(`[CRM EVENT ERROR] Falha ao registrar evento ${input.action}:`, error);
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
      console.warn(`[CRM EVENT EMIT WARNING] n8n respondeu com status ${response.status}`);
    }
  } catch (error) {
    console.error(`[CRM EVENT EMIT ERROR] Falha ao enviar para n8n:`, error);
  }
}
