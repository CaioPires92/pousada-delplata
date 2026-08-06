import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    chatbotSettings: {
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  getChatbotRuntimeSettings,
  isPipelineAutomationEnabled,
  isWhatsappChatbotGloballyEnabled,
  isWhatsappChatbotEnabledForConversation,
} from "./chatbotSettings";

describe("chatbot global settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when no global settings exist", async () => {
    vi.mocked(prisma.chatbotSettings.findFirst).mockResolvedValue(null);

    await expect(getChatbotRuntimeSettings()).resolves.toEqual({
      enabledGlobal: false,
      enabledWhatsapp: false,
      pipelineAutomationEnabled: true,
    });
    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(false);
  });

  it("requires both global and WhatsApp switches", async () => {
    vi.mocked(prisma.chatbotSettings.findFirst)
      .mockResolvedValueOnce({ enabledGlobal: true, enabledWhatsapp: false } as never)
      .mockResolvedValueOnce({ enabledGlobal: true, enabledWhatsapp: true } as never);

    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(false);
    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(true);
  });

  it("fails closed when the settings query fails", async () => {
    vi.mocked(prisma.chatbotSettings.findFirst).mockRejectedValue(new Error("database unavailable"));

    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(false);
  });

  it("keeps pipeline automation independent from chatbot replies", async () => {
    vi.mocked(prisma.chatbotSettings.findFirst).mockResolvedValue({
      enabledGlobal: false,
      enabledWhatsapp: false,
      pipelineAutomationEnabled: true,
    } as never);

    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(false);
    await expect(isPipelineAutomationEnabled()).resolves.toBe(true);
  });

  it("fails closed when the pipeline setting query fails", async () => {
    vi.mocked(prisma.chatbotSettings.findFirst).mockRejectedValue(new Error("database unavailable"));

    await expect(isPipelineAutomationEnabled()).resolves.toBe(false);
  });

  it("allows one explicitly enabled test conversation while the global bot stays off", async () => {
    vi.mocked(prisma.chatbotSettings.findFirst).mockResolvedValue({
      enabledGlobal: false,
      enabledWhatsapp: false,
      pipelineAutomationEnabled: true,
    } as never);

    await expect(isWhatsappChatbotEnabledForConversation(true)).resolves.toBe(true);
    expect(prisma.chatbotSettings.findFirst).not.toHaveBeenCalled();
    await expect(isWhatsappChatbotEnabledForConversation(false)).resolves.toBe(false);
  });
});
