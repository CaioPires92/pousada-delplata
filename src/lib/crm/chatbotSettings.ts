import prisma from "@/lib/prisma";

export type ChatbotRuntimeSettings = {
  enabledGlobal: boolean;
  enabledWhatsapp: boolean;
  pipelineAutomationEnabled: boolean;
};

export const DEFAULT_CHATBOT_RUNTIME_SETTINGS: ChatbotRuntimeSettings = {
  enabledGlobal: false,
  enabledWhatsapp: false,
  pipelineAutomationEnabled: true,
};

export async function getChatbotRuntimeSettings(): Promise<ChatbotRuntimeSettings> {
  const settings = await prisma.chatbotSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      enabledGlobal: true,
      enabledWhatsapp: true,
      pipelineAutomationEnabled: true,
    },
  });

  return settings ?? DEFAULT_CHATBOT_RUNTIME_SETTINGS;
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
