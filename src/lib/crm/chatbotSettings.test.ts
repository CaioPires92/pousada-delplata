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
  isAutoReplyIntentReleased,
  isPipelineAutomationEnabled,
  isWhatsappChatbotGloballyEnabled,
  isWhatsappChatbotEnabledForConversation,
  deterministicRolloutBucket,
  isConversationInAutoReplyRollout,
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
      releasedAutoReplyIntents: ["quote"],
      autoReplyRolloutPercentage: 0,
    });
    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(false);
  });

  it("uses a stable rollout bucket and defaults production to zero percent", async () => {
    expect(deterministicRolloutBucket("conversation-1")).toBe(deterministicRolloutBucket("conversation-1"));
    expect(deterministicRolloutBucket("conversation-1")).toBeGreaterThanOrEqual(1);
    expect(deterministicRolloutBucket("conversation-1")).toBeLessThanOrEqual(100);
    vi.mocked(prisma.chatbotSettings.findFirst).mockResolvedValue({
      enabledGlobal: true,
      enabledWhatsapp: true,
      pipelineAutomationEnabled: true,
      autoReplyIntentsJson: '["quote"]',
      autoReplyRolloutPercentage: 0,
    } as never);
    await expect(isConversationInAutoReplyRollout("conversation-1")).resolves.toBe(false);
    await expect(isConversationInAutoReplyRollout("conversation-1", true)).resolves.toBe(true);
  });

  it("includes only the deterministic percentage of production conversations", async () => {
    const id = "conversation-rollout";
    const bucket = deterministicRolloutBucket(id);
    vi.mocked(prisma.chatbotSettings.findFirst)
      .mockResolvedValueOnce({ autoReplyRolloutPercentage: bucket - 1 } as never)
      .mockResolvedValueOnce({ autoReplyRolloutPercentage: bucket } as never);

    await expect(isConversationInAutoReplyRollout(id)).resolves.toBe(false);
    await expect(isConversationInAutoReplyRollout(id)).resolves.toBe(true);
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

  it("releases only configured production intents and lets a test conversation exercise known intents", async () => {
    vi.mocked(prisma.chatbotSettings.findFirst).mockResolvedValue({
      enabledGlobal: true,
      enabledWhatsapp: true,
      pipelineAutomationEnabled: true,
      autoReplyIntentsJson: '["quote","parking","unknown-value"]',
    } as never);

    await expect(isAutoReplyIntentReleased("parking", false)).resolves.toBe(true);

    vi.mocked(prisma.chatbotSettings.findFirst).mockResolvedValue({
      enabledGlobal: true,
      enabledWhatsapp: true,
      pipelineAutomationEnabled: true,
      autoReplyIntentsJson: '["quote"]',
    } as never);
    await expect(isAutoReplyIntentReleased("parking", false)).resolves.toBe(false);
    await expect(isAutoReplyIntentReleased("parking", true)).resolves.toBe(true);
    await expect(isAutoReplyIntentReleased("unknown", true)).resolves.toBe(false);
  });

  it("treats approved FAQ as an explicit rollout category", async () => {
    vi.mocked(prisma.chatbotSettings.findFirst).mockResolvedValue({
      autoReplyIntentsJson: '["quote","faq"]',
    } as never);

    await expect(isAutoReplyIntentReleased("faq", false)).resolves.toBe(true);
  });
});
