import prisma from "@/lib/prisma";
import type { CrmIntent } from "@/lib/crm/intentParser";
import { evaluateAutoReplyRolloutGate } from "@/lib/crm/rolloutGate";

export const AUTO_REPLY_INTENTS = [
  "faq",
  "quote",
  "reservation",
  "checkin_info",
  "checkout_info",
  "amenity",
  "pet",
  "parking",
  "location",
] as const;

export type AutoReplyIntent = typeof AUTO_REPLY_INTENTS[number];

export type ChatbotRuntimeSettings = {
  enabledGlobal: boolean;
  enabledWhatsapp: boolean;
  pipelineAutomationEnabled: boolean;
  releasedAutoReplyIntents: AutoReplyIntent[];
  autoReplyRolloutPercentage: number;
};

export const DEFAULT_CHATBOT_RUNTIME_SETTINGS: ChatbotRuntimeSettings = {
  enabledGlobal: false,
  enabledWhatsapp: false,
  pipelineAutomationEnabled: true,
  releasedAutoReplyIntents: ["quote"],
  autoReplyRolloutPercentage: 0,
};

export function normalizeRolloutPercentage(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function deterministicRolloutBucket(stableId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < stableId.length; index += 1) {
    hash ^= stableId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100 + 1;
}

export function parseReleasedAutoReplyIntents(value: string | null | undefined): AutoReplyIntent[] {
  if (!value) return [...DEFAULT_CHATBOT_RUNTIME_SETTINGS.releasedAutoReplyIntents];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [...DEFAULT_CHATBOT_RUNTIME_SETTINGS.releasedAutoReplyIntents];
    const allowed = new Set<string>(AUTO_REPLY_INTENTS);
    return Array.from(new Set(parsed.filter((item): item is AutoReplyIntent => typeof item === "string" && allowed.has(item))));
  } catch {
    return [...DEFAULT_CHATBOT_RUNTIME_SETTINGS.releasedAutoReplyIntents];
  }
}

export async function getChatbotRuntimeSettings(): Promise<ChatbotRuntimeSettings> {
  const settings = await prisma.chatbotSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      enabledGlobal: true,
      enabledWhatsapp: true,
      pipelineAutomationEnabled: true,
      autoReplyIntentsJson: true,
      autoReplyRolloutPercentage: true,
    },
  });

  if (!settings) return DEFAULT_CHATBOT_RUNTIME_SETTINGS;
  return {
    enabledGlobal: settings.enabledGlobal,
    enabledWhatsapp: settings.enabledWhatsapp,
    pipelineAutomationEnabled: settings.pipelineAutomationEnabled,
    releasedAutoReplyIntents: parseReleasedAutoReplyIntents(settings.autoReplyIntentsJson),
    autoReplyRolloutPercentage: normalizeRolloutPercentage(settings.autoReplyRolloutPercentage),
  };
}

export async function isConversationInAutoReplyRollout(
  conversationId: string,
  testConversation = false,
): Promise<boolean> {
  if (testConversation) return true;
  try {
    const settings = await getChatbotRuntimeSettings();
    if (deterministicRolloutBucket(conversationId) > settings.autoReplyRolloutPercentage) return false;
    const gate = await evaluateAutoReplyRolloutGate();
    return gate.approved;
  } catch {
    return false;
  }
}

export async function isAutoReplyIntentReleased(
  intent: CrmIntent | AutoReplyIntent,
  testConversation = false,
): Promise<boolean> {
  if (testConversation) return intent !== "unknown";
  try {
    const settings = await getChatbotRuntimeSettings();
    return settings.releasedAutoReplyIntents.includes(intent as AutoReplyIntent);
  } catch (error) {
    console.error("Falha ao consultar rollout de intenções", {
      errorCode: error && typeof error === "object" && "code" in error ? String(error.code) : "unknown_error",
    });
    return false;
  }
}

export async function isPipelineAutomationEnabled(): Promise<boolean> {
  try {
    const settings = await getChatbotRuntimeSettings();
    return settings.pipelineAutomationEnabled;
  } catch (error) {
    console.error("Falha ao consultar o interruptor da automação do funil", {
      errorCode: error && typeof error === "object" && "code" in error ? String(error.code) : "unknown_error",
    });
    return false;
  }
}

export async function isWhatsappChatbotGloballyEnabled(): Promise<boolean> {
  try {
    const settings = await getChatbotRuntimeSettings();
    return settings.enabledGlobal && settings.enabledWhatsapp;
  } catch (error) {
    console.error("Falha ao consultar o interruptor global do chatbot", {
      errorCode: error && typeof error === "object" && "code" in error ? String(error.code) : "unknown_error",
    });
    return false;
  }
}

export async function isWhatsappChatbotEnabledForConversation(
  chatbotTestEnabled: boolean,
): Promise<boolean> {
  if (chatbotTestEnabled) return true;
  return isWhatsappChatbotGloballyEnabled();
}
