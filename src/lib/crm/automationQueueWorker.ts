import prisma from "@/lib/prisma";

import { buildAuditMetadata } from "@/lib/crm/audit";
import { processNextAutomationJobForConversation } from "@/lib/crm/automationQueue";
import { crmLog } from "@/lib/crm/logger";
import { recordCrmEvent } from "@/lib/crm/events";
import { sendEvolutionTextWithRetry } from "@/lib/whatsapp/evolution";

function extractEvolutionMessageId(response: unknown): string | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const root = response as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : undefined;
  const key = root.key && typeof root.key === "object" ? root.key as Record<string, unknown> : data?.key && typeof data.key === "object" ? data.key as Record<string, unknown> : undefined;

  const candidates = [root.id, root.messageId, data?.id, data?.messageId, key?.id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  return null;
}

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
      if (job.action !== "SEND_WHATSAPP_MESSAGE" || !job.payload.text || !job.payload.target) {
        throw new Error("invalid_queue_payload");
      }

      const evolutionResponse = await sendEvolutionTextWithRetry({
        number: job.payload.target,
        text: job.payload.text,
      });

      const now = new Date();
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalMessageId: extractEvolutionMessageId(evolutionResponse),
          senderType: "bot",
          content: job.payload.text,
          messageType: "text",
          sentAt: now,
          metadataJson: JSON.stringify({
            actorType: "system",
            queueJobId: job.id,
            evolutionResponse,
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
