import prisma from "@/lib/prisma";
import type { CrmIntent } from "@/lib/crm/intentParser";

export const AUTO_REPLY_INTENTS = [
  "quote",
  "reservation",
  "checkin_info",
  "checkout_info",
  "amenity",
  "pet",
  "parking",
  "location",
] as const satisfies readonly CrmIntent[];

export type AutoReplyIntent = typeof AUTO_REPLY_INTENTS[number];

export type ChatbotRuntimeSettings = {
  enabledGlobal: boolean;
  enabledWhatsapp: boolean;
  pipelineAutomationEnabled: boolean;
  releasedAutoReplyIntents: AutoReplyIntent[];
};

export const DEFAULT_CHATBOT_RUNTIME_SETTINGS: ChatbotRuntimeSettings = {
  enabledGlobal: false,
  enabledWhatsapp: false,
  pipelineAutomationEnabled: true,
  releasedAutoReplyIntents: ["quote"],
};

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
    },
  });

  if (!settings) return DEFAULT_CHATBOT_RUNTIME_SETTINGS;
  return {
    enabledGlobal: settings.enabledGlobal,
    enabledWhatsapp: settings.enabledWhatsapp,
    pipelineAutomationEnabled: settings.pipelineAutomationEnabled,
    releasedAutoReplyIntents: parseReleasedAutoReplyIntents(settings.autoReplyIntentsJson),
  };
}

export async function isAutoReplyIntentReleased(
  intent: CrmIntent,
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
