import prisma from "@/lib/prisma";
import { executeAutomationHandoff } from "@/lib/crm/automationHandoff";
import { DEFAULT_AUTOMATION_HANDOFF_MESSAGE } from "@/lib/crm/handoffPolicy";
import { recordCrmEvent } from "@/lib/crm/events";

export type PostStayFeedbackClassification = "positive" | "neutral" | "problem" | "unknown";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function classifyPostStayFeedback(message: string): PostStayFeedbackClassification {
  const text = normalize(message);
  if (/\b(pessim|ruim|horrivel|problema|reclam|insatisfeit|sujo|barulho|nao gostei|decepcion)\w*/.test(text)) {
    return "problem";
  }
  if (/\b(excelente|otim|maravilhos|perfeit|adorei|amei|muito bom|gostei)\w*/.test(text)) {
    return "positive";
  }
  if (/^(?:foi\s+)?(?:ok|normal|regular|mais ou menos|tranquilo|boa?)\W*$/.test(text)) {
    return "neutral";
  }
  return "unknown";
}

function bookingIdFromFlowData(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "{}") as { bookingId?: unknown };
    return typeof parsed.bookingId === "string" ? parsed.bookingId : null;
  } catch {
    return null;
  }
}

export async function processPostStayFeedback(input: {
  conversation: {
    id: string;
    contactId: string;
    currentFlow: string | null;
    flowStep: string | null;
    flowDataJson: string | null;
  };
  phone: string;
  message: string;
  now?: Date;
}) {
  if (input.conversation.currentFlow !== "post_stay" || input.conversation.flowStep !== "waiting_satisfaction") {
    return { handled: false as const, response: null };
  }

  const now = input.now ?? new Date();
  const bookingId = bookingIdFromFlowData(input.conversation.flowDataJson);
  const classification = classifyPostStayFeedback(input.message);
  await recordCrmEvent({
    action: classification === "problem" ? "PostStayIssueDetected" : "PostStayFeedbackClassified",
    bookingId: bookingId ?? undefined,
    contactId: input.conversation.contactId,
    conversationId: input.conversation.id,
    metadata: { classification, source: "whatsapp" },
  });

  if (classification === "problem" || classification === "unknown") {
    const response = await executeAutomationHandoff({
      conversationId: input.conversation.id,
      contactId: input.conversation.contactId,
      phone: input.phone,
      decision: {
        shouldHandoff: true,
        reason: classification === "problem" ? "complaint_or_emergency" : "low_confidence",
        message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE,
      },
      now,
    });
    return { handled: true as const, classification, response };
  }

  await prisma.conversation.update({
    where: { id: input.conversation.id },
    data: {
      flowStep: "feedback_classified",
      flowDataJson: JSON.stringify({
        bookingId,
        classification,
        feedbackAt: now.toISOString(),
        reviewEligible: classification === "positive",
      }),
      lastAutomationAt: now,
    },
  });
  return { handled: true as const, classification, response: null };
}
