import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import type { AutomationHandoffDecision } from "@/lib/crm/handoffPolicy";
import { sendMessagingText } from "@/lib/messaging/send-text";

export async function executeAutomationHandoff(input: {
  conversationId: string;
  contactId: string;
  phone: string;
  decision: AutomationHandoffDecision;
  now?: Date;
}) {
  if (!input.decision.shouldHandoff || !input.decision.reason || !input.decision.message) {
    return null;
  }

  const now = input.now ?? new Date();
  const claimed = await prisma.conversation.updateMany({
    where: {
      id: input.conversationId,
      chatbotEnabled: true,
    },
    data: {
      chatbotEnabled: false,
      currentFlow: null,
      flowStep: null,
      flowDataJson: null,
      lastAutomationAt: now,
    },
  });

  if (claimed.count === 0) return null;

  try {
    const sendResult = await sendMessagingText(input.phone, input.decision.message);

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: input.conversationId,
          externalMessageId: sendResult.externalMessageId,
          senderType: "bot",
          content: input.decision.message,
          messageType: "text",
          sentAt: now,
          metadataJson: JSON.stringify({
            ...sendResult,
            automationAction: "handoff",
            handoffReason: input.decision.reason,
          }),
        },
      }),
      prisma.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: now },
      }),
    ]);

    await recordCrmEvent({
      action: "AutomationHandoffRequested",
      contactId: input.contactId,
      conversationId: input.conversationId,
      metadata: {
        reason: input.decision.reason,
        messageSent: true,
      },
    });

    return input.decision.message;
  } catch (error) {
    await recordCrmEvent({
      action: "AutomationHandoffNotificationFailed",
      contactId: input.contactId,
      conversationId: input.conversationId,
      metadata: {
        reason: input.decision.reason,
        errorCode: error && typeof error === "object" && "code" in error ? String(error.code) : "unknown_error",
      },
    });
    throw error;
  }
}
