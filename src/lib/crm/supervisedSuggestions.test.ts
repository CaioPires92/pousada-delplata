import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    conversation: { findUnique: vi.fn() },
    supervisedReplySuggestion: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/crm/approvedKnowledge", () => ({ findApprovedKnowledge: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { findApprovedKnowledge } from "@/lib/crm/approvedKnowledge";
import { recordCrmEvent } from "@/lib/crm/events";
import { createSupervisedSuggestionForInbound } from "./supervisedSuggestions";

const input = {
  conversationId: "conversation-1",
  contactId: "contact-1",
  sourceMessageId: "message-1",
  text: "Qual é o horário do check-in?",
};

describe("supervised reply suggestions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing outside supervised mode", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({ automationMode: "auto" } as never);

    await expect(createSupervisedSuggestionForInbound(input)).resolves.toBeNull();
    expect(findApprovedKnowledge).not.toHaveBeenCalled();
  });

  it("does not improvise when approved knowledge has no match", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({ automationMode: "supervised" } as never);
    vi.mocked(findApprovedKnowledge).mockResolvedValue(null);

    await expect(createSupervisedSuggestionForInbound(input)).resolves.toBeNull();
    expect(prisma.supervisedReplySuggestion.upsert).not.toHaveBeenCalled();
  });

  it("stores an idempotent unapproved suggestion from public approved knowledge", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({ automationMode: "supervised" } as never);
    vi.mocked(findApprovedKnowledge).mockResolvedValue({
      ruleId: "rule-1",
      response: "O check-in começa às 14h.",
      category: "checkin_info",
      version: 2,
    });
    vi.mocked(prisma.supervisedReplySuggestion.upsert).mockResolvedValue({ id: "suggestion-1" } as never);
    vi.mocked(recordCrmEvent).mockResolvedValue(null as never);

    await expect(createSupervisedSuggestionForInbound(input)).resolves.toMatchObject({ id: "suggestion-1" });
    expect(prisma.supervisedReplySuggestion.upsert).toHaveBeenCalledWith({
      where: { sourceMessageId: "message-1" },
      create: expect.objectContaining({
        conversationId: "conversation-1",
        content: "O check-in começa às 14h.",
        ruleId: "rule-1",
        ruleVersion: 2,
      }),
      update: {},
    });
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "SupervisedReplySuggested",
      metadata: expect.objectContaining({ actionAuthorized: false }),
    }));
  });
});
