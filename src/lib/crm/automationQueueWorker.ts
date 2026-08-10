import prisma from "@/lib/prisma";

import { buildAuditMetadata } from "@/lib/crm/audit";
import { processNextAutomationJobForConversation } from "@/lib/crm/automationQueue";
import { crmLog } from "@/lib/crm/logger";
import { recordCrmEvent } from "@/lib/crm/events";
import { deliverN8nEvent } from "@/lib/crm/n8nDelivery";
import { CircuitBreaker } from "@/lib/messaging/circuit-breaker";
import { createMessagingProvider } from "@/lib/messaging/provider-factory";
import { isConversationAutomationActive } from "@/lib/crm/automationPause";
import { getFollowUpCadenceSettings } from "@/lib/crm/followUpCadence";
import { isWithinQuietHours, moveAfterQuietHours } from "@/lib/crm/quietHours";
import { assertOutboundProviderPolicy } from "@/lib/messaging/outbound-policy";

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
  const now = new Date();
  const followUpSettings = await getFollowUpCadenceSettings();

  const pending = await prisma.automationQueueJob.findMany({
    where: {
      status: "pending",
      OR: [
        { scheduledAt: null },
        { scheduledAt: { lte: now } },
      ],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
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

      if (
        ["commercial_followup", "broadcast", "post_stay"].includes(job.journeyType ?? "")
        && isWithinQuietHours({
          date: now,
          startHour: followUpSettings.quietHoursStart,
          endHour: followUpSettings.quietHoursEnd,
        })
      ) {
        return {
          rescheduled: true as const,
          reason: "quiet_hours",
          scheduledAt: moveAfterQuietHours({
            date: now,
            startHour: followUpSettings.quietHoursStart,
            endHour: followUpSettings.quietHoursEnd,
          }),
        };
      }

      const currentConversation = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        select: {
          chatbotEnabled: true,
          automationMode: true,
          automationPausedUntil: true,
          contact: { select: { optOutAt: true } },
        },
      });
      if (currentConversation?.contact?.optOutAt) {
        return { cancelled: true as const, reason: "contact_opted_out" };
      }
      if (!isConversationAutomationActive(currentConversation)) {
        return { cancelled: true as const, reason: "human_takeover_or_automation_paused" };
      }

      const provider = createMessagingProvider();
      const outboundMessage = {
        kind: "text" as const,
        recipientId: job.payload.target!,
        text: job.payload.text!,
      };
      const lastInbound = provider.name === "meta"
        ? await prisma.message.findFirst({
            where: { conversationId: conversation.id, senderType: "guest" },
            orderBy: { sentAt: "desc" },
            select: { sentAt: true },
          })
        : null;
      assertOutboundProviderPolicy({
        provider: provider.name === "meta" ? "meta" : "evolution",
        message: outboundMessage,
        lastInboundAt: lastInbound?.sentAt,
      });
      const sendResult = await messagingCircuitBreaker.execute(() =>
        provider.send(outboundMessage)
      );

      const sentAt = new Date();
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalMessageId: sendResult.externalMessageId,
          senderType: "bot",
          content: job.payload.text,
          messageType: "text",
          sentAt,
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
        data: { lastMessageAt: sentAt },
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
    }, { now });

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
