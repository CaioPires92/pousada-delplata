import prisma from "@/lib/prisma";

import { buildAuditMetadata } from "@/lib/crm/audit";
import { processNextAutomationJobForConversation } from "@/lib/crm/automationQueue";
import { crmLog } from "@/lib/crm/logger";
import { recordCrmEvent } from "@/lib/crm/events";
import { deliverN8nEvent } from "@/lib/crm/n8nDelivery";
import { CircuitBreaker } from "@/lib/messaging/circuit-breaker";
import { createMessagingProvider } from "@/lib/messaging/provider-factory";

const messagingCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  shouldCountFailure: error => !(
    error
    && typeof error === "object"
    && "retryable" in error
    && error.retryable === false
  ),
});

export async function runAutomationQueueWorker(input?: { maxConversations?: number }) {
  const maxConversations = Math.max(1, input?.maxConversations ?? 20);

  const pending = await prisma.automationQueueJob.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { conversationId: true },
  });

  const conversationIds = Array.from(new Set(pending.map(item => item.conversationId))).slice(0, maxConversations);

  let processed = 0;
  let failed = 0;

  for (const conversationId of conversationIds) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        contactId: true,
      },
    });

    if (!conversation) continue;

    const result = await processNextAutomationJobForConversation(conversation.id, async job => {
      if (job.action === "EMIT_N8N_EVENT") {
        if (!job.payload.event) throw new Error("invalid_n8n_event_payload");
        const delivery = await deliverN8nEvent(job.payload.event);
        if (!delivery.delivered) throw new Error("n8n_delivery_disabled");
        return;
      }

      if (job.action !== "SEND_WHATSAPP_MESSAGE" || !job.payload.text || !job.payload.target) {
        throw new Error("invalid_queue_payload");
      }

      const provider = createMessagingProvider();
      const sendResult = await messagingCircuitBreaker.execute(() =>
        provider.send({
          kind: "text",
          recipientId: job.payload.target!,
          text: job.payload.text!,
        })
      );

      const now = new Date();
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalMessageId: sendResult.externalMessageId,
          senderType: "bot",
          content: job.payload.text,
          messageType: "text",
          sentAt: now,
          metadataJson: JSON.stringify({
            actorType: "system",
            queueJobId: job.id,
            provider: provider.name,
            acceptedAt: sendResult.acceptedAt,
            status: sendResult.status,
          }),
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: now },
      });

      await recordCrmEvent({
        action: "WhatsAppMessageSent",
        contactId: conversation.contactId,
        conversationId: conversation.id,
        metadata: {
          ...buildAuditMetadata({ actorType: "system", origin: "system" }),
          queueJobId: job.id,
          messageId: message.id,
          externalMessageId: message.externalMessageId,
        },
      });
    });

    if (result.processed) {
      processed += 1;
      if (!result.ok) failed += 1;
    }
  }

  crmLog({
    level: "AUTOMATION",
    action: "AutomationQueueWorkerRun",
    message: "Automation queue worker finished batch",
    context: {
      conversations: conversationIds.length,
      processed,
      failed,
    },
  });

  return {
    ok: true,
    conversations: conversationIds.length,
    processed,
    failed,
  };
}
