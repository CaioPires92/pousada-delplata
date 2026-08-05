import prisma from "@/lib/prisma";

export type ChatbotRuntimeSettings = {
  enabledGlobal: boolean;
  enabledWhatsapp: boolean;
};

export const DEFAULT_CHATBOT_RUNTIME_SETTINGS: ChatbotRuntimeSettings = {
  enabledGlobal: false,
  enabledWhatsapp: false,
};

export async function getChatbotRuntimeSettings(): Promise<ChatbotRuntimeSettings> {
  const settings = await prisma.chatbotSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      enabledGlobal: true,
      enabledWhatsapp: true,
    },
  });

  return settings ?? DEFAULT_CHATBOT_RUNTIME_SETTINGS;
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
