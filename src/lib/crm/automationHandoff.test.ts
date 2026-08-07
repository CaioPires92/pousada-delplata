import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    conversation: { updateMany: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/messaging/send-text", () => ({ sendMessagingText: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { DEFAULT_AUTOMATION_HANDOFF_MESSAGE } from "@/lib/crm/handoffPolicy";
import { sendMessagingText } from "@/lib/messaging/send-text";
import { executeAutomationHandoff } from "./automationHandoff";

const decision = {
  shouldHandoff: true,
  reason: "unknown_intent" as const,
  message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE,
};

describe("executeAutomationHandoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.conversation.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(sendMessagingText).mockResolvedValue({
      externalMessageId: "handoff-message",
      acceptedAt: "2026-08-05T18:00:00.000Z",
      status: "sent",
      provider: "evolution",
    });
    vi.mocked(prisma.message.create).mockReturnValue({} as never);
    vi.mocked(prisma.conversation.update).mockReturnValue({} as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);
  });

  it("disables automation before sending one safe handoff message", async () => {
    await expect(executeAutomationHandoff({
      conversationId: "conversation-1",
      contactId: "contact-1",
      phone: "5511999999999",
      decision,
      now: new Date("2026-08-05T18:00:00.000Z"),
    })).resolves.toBe(DEFAULT_AUTOMATION_HANDOFF_MESSAGE);

    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "conversation-1", chatbotEnabled: true, automationMode: "auto" },
      data: expect.objectContaining({
        chatbotEnabled: false,
        chatbotTestEnabled: false,
        automationMode: "off",
        currentFlow: null,
      }),
    }));
    expect(sendMessagingText).toHaveBeenCalledOnce();
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "AutomationHandoffRequested",
      metadata: expect.objectContaining({ reason: "unknown_intent" }),
    }));
  });

  it("does not send again when another execution already claimed the conversation", async () => {
    vi.mocked(prisma.conversation.updateMany).mockResolvedValue({ count: 0 });

    await expect(executeAutomationHandoff({
      conversationId: "conversation-1",
      contactId: "contact-1",
      phone: "5511999999999",
      decision,
    })).resolves.toBeNull();

    expect(sendMessagingText).not.toHaveBeenCalled();
  });
});
