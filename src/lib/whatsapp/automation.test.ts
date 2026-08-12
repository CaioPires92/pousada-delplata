import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    conversation: { findUnique: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
    pipelineCard: { findFirst: vi.fn() },
    reservationDraft: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/crm/chatbotSettings", () => ({
  isWhatsappChatbotEnabledForConversation: vi.fn(),
  isAutoReplyIntentReleased: vi.fn(),
  isConversationInAutoReplyRollout: vi.fn(),
}));
vi.mock("@/lib/crm/automationPause", () => ({
  isConversationAutomationActive: vi.fn(),
}));
vi.mock("@/lib/crm/automationHandoff", () => ({ executeAutomationHandoff: vi.fn() }));
vi.mock("@/lib/crm/approvedKnowledge", () => ({ findApprovedKnowledge: vi.fn() }));
vi.mock("@/lib/crm/cacheStore", () => ({ cacheSetNx: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));
vi.mock("@/lib/messaging/send-text", () => ({ sendMessagingText: vi.fn() }));
vi.mock("@/app/api/crm/quote/route", () => ({ POST: vi.fn() }));
vi.mock("@/app/api/crm/internal-actions/route", () => ({ POST: vi.fn() }));

import prisma from "@/lib/prisma";
import { executeAutomationHandoff } from "@/lib/crm/automationHandoff";
import { findApprovedKnowledge } from "@/lib/crm/approvedKnowledge";
import { isConversationAutomationActive } from "@/lib/crm/automationPause";
import { isAutoReplyIntentReleased, isConversationInAutoReplyRollout, isWhatsappChatbotEnabledForConversation } from "@/lib/crm/chatbotSettings";
import { recordCrmEvent } from "@/lib/crm/events";
import { DEFAULT_AUTOMATION_CLARIFICATION_MESSAGE } from "@/lib/crm/handoffPolicy";
import { sendMessagingText } from "@/lib/messaging/send-text";
import { AUTO_REPLY_WAIT_MS, processAutoResponse } from "./automation";

function conversation(failureCount: number, chatbotTestEnabled = true) {
  return {
    id: "conversation-1",
    contactId: "contact-1",
    chatbotEnabled: true,
    chatbotTestEnabled,
    automationMode: "auto",
    automationPausedUntil: null,
    currentFlow: null,
    flowStep: null,
    flowDataJson: null,
    lastAutomationAt: null,
    automationFailureCount: failureCount,
  };
}

describe("processAutoResponse handoff supervision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isWhatsappChatbotEnabledForConversation).mockResolvedValue(true);
    vi.mocked(isConversationInAutoReplyRollout).mockResolvedValue(true);
    vi.mocked(isAutoReplyIntentReleased).mockResolvedValue(true);
    vi.mocked(isConversationAutomationActive).mockReturnValue(true);
    vi.mocked(findApprovedKnowledge).mockResolvedValue(null);
    vi.mocked(recordCrmEvent).mockResolvedValue(null as never);
    vi.mocked(sendMessagingText).mockResolvedValue({
      externalMessageId: "message-1",
      acceptedAt: "2026-08-07T19:00:00.000Z",
      status: "sent",
      provider: "evolution",
    });
    vi.mocked(prisma.message.create).mockResolvedValue({} as never);
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
    vi.mocked(prisma.$transaction).mockImplementation(async callback => {
      if (typeof callback === "function") {
        return callback(prisma as never);
      }
      return [];
    });
  });

  it("does not send anything outside the deterministic rollout", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(conversation(0, false) as never);
    vi.mocked(isConversationInAutoReplyRollout).mockResolvedValue(false);

    await expect(processAutoResponse(
      "conversation-1",
      "5519999999999",
      "Qual é o horário do check-in?",
    )).resolves.toBeNull();

    expect(sendMessagingText).not.toHaveBeenCalled();
    expect(executeAutomationHandoff).not.toHaveBeenCalled();
  });

  it("asks for clarification and records the first comprehension failure", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(conversation(0) as never);

    await expect(processAutoResponse(
      "conversation-1",
      "5519999999999",
      "Quero uma coisa diferente",
    )).resolves.toBe(DEFAULT_AUTOMATION_CLARIFICATION_MESSAGE);

    expect(sendMessagingText).toHaveBeenCalledWith("5519999999999", DEFAULT_AUTOMATION_CLARIFICATION_MESSAGE);
    expect(prisma.conversation.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "conversation-1" },
      data: expect.objectContaining({ automationFailureCount: 1 }),
    }));
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "AutomationClarificationRequested",
    }));
    expect(executeAutomationHandoff).not.toHaveBeenCalled();
  });

  it("waits after one automatic reply before responding again", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      ...conversation(1),
      lastAutomationAt: new Date(Date.now() - AUTO_REPLY_WAIT_MS + 1_000),
    } as never);

    await expect(processAutoResponse(
      "conversation-1",
      "5519999999999",
      "Outra mensagem logo em seguida",
    )).resolves.toBeNull();

    expect(findApprovedKnowledge).not.toHaveBeenCalled();
    expect(sendMessagingText).not.toHaveBeenCalled();
    expect(executeAutomationHandoff).not.toHaveBeenCalled();
  });

  it("serializes concurrent responses from the same conversation", async () => {
    let lastAutomationAt: Date | null = null;
    vi.mocked(prisma.conversation.findUnique).mockImplementation((async () => ({
      ...conversation(lastAutomationAt ? 1 : 0),
      lastAutomationAt,
    })) as never);
    vi.mocked(prisma.conversation.update).mockImplementation((async (input: { data: unknown }) => {
      const data = input.data as { lastAutomationAt?: Date };
      if (data.lastAutomationAt) lastAutomationAt = data.lastAutomationAt;
      return {} as never;
    }) as never);

    const results = await Promise.all([
      processAutoResponse("conversation-1", "5519999999999", "Kkk"),
      processAutoResponse("conversation-1", "5519999999999", "Kkk de novo"),
    ]);

    expect(results.filter(Boolean)).toEqual([DEFAULT_AUTOMATION_CLARIFICATION_MESSAGE]);
    expect(sendMessagingText).toHaveBeenCalledTimes(1);
  });

  it("hands off on the second consecutive comprehension failure", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(conversation(1) as never);
    vi.mocked(executeAutomationHandoff).mockResolvedValue("handoff");

    await expect(processAutoResponse(
      "conversation-1",
      "5519999999999",
      "Ainda não foi isso",
    )).resolves.toBe("handoff");

    expect(executeAutomationHandoff).toHaveBeenCalledWith(expect.objectContaining({
      decision: expect.objectContaining({ reason: "repeated_failure", shouldHandoff: true }),
    }));
    expect(sendMessagingText).not.toHaveBeenCalled();
  });

  it("answers approved knowledge even after a previous comprehension failure", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(conversation(1) as never);
    vi.mocked(findApprovedKnowledge).mockResolvedValue({
      ruleId: "faq-wifi-password",
      response: "A senha do Wi-Fi é pousada151 em todas as redes.",
      category: "faq",
      version: 2,
    });
    vi.mocked(isAutoReplyIntentReleased).mockResolvedValue(false);
    vi.mocked(prisma.pipelineCard.findFirst).mockResolvedValue(null);

    await expect(processAutoResponse(
      "conversation-1",
      "5519999999999",
      "Qual a senha do Wi-Fi?",
    )).resolves.toBe("A senha do Wi-Fi é pousada151 em todas as redes.");

    expect(sendMessagingText).toHaveBeenCalledWith(
      "5519999999999",
      "A senha do Wi-Fi é pousada151 em todas as redes.",
    );
    expect(executeAutomationHandoff).not.toHaveBeenCalled();
  });

  it("keeps explicit human handoff above an approved FAQ match", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(conversation(0) as never);
    vi.mocked(findApprovedKnowledge).mockResolvedValue({
      ruleId: "faq-wifi-password",
      response: "A senha do Wi-Fi é pousada151 em todas as redes.",
      category: "faq",
      version: 2,
    });
    vi.mocked(executeAutomationHandoff).mockResolvedValue("handoff");

    await expect(processAutoResponse(
      "conversation-1",
      "5519999999999",
      "Quero falar com um atendente sobre a senha do Wi-Fi",
    )).resolves.toBe("handoff");

    expect(executeAutomationHandoff).toHaveBeenCalledWith(expect.objectContaining({
      decision: expect.objectContaining({ reason: "human_requested" }),
    }));
    expect(sendMessagingText).not.toHaveBeenCalled();
  });

  it("hands off a production intent that has not been released", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(conversation(0, false) as never);
    vi.mocked(isAutoReplyIntentReleased).mockResolvedValue(false);
    vi.mocked(executeAutomationHandoff).mockResolvedValue("handoff");

    await expect(processAutoResponse(
      "conversation-1",
      "5519999999999",
      "Qual é o horário do check-in?",
    )).resolves.toBe("handoff");

    expect(isAutoReplyIntentReleased).toHaveBeenCalledWith("checkin_info", false);
    expect(executeAutomationHandoff).toHaveBeenCalledWith(expect.objectContaining({
      decision: expect.objectContaining({ reason: "intent_not_released" }),
    }));
  });
});
