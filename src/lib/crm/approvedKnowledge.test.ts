import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    chatbotRule: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { findApprovedKnowledge } from "./approvedKnowledge";

describe("approved chatbot knowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.chatbotRule.findMany).mockResolvedValue([
      { id: "rule-oi", trigger: "oi", response: "Olá!", category: "saudacao", version: 1 },
      { id: "rule-wifi", trigger: "Wi-Fi", response: "Temos Wi-Fi.", category: "faq", version: 1 },
      { id: "rule-wifi-password", trigger: "senha do Wi-Fi", response: "Consulte a recepção.", category: "faq", version: 1 },
    ] as never);
  });

  it.each([
    "Qual a senha do wifi?",
    "senha do wi-fi",
    "Pode informar a senha do wi fi?",
  ])("normalizes Wi-Fi spelling variants in %s", async message => {
    await expect(findApprovedKnowledge(message)).resolves.toEqual({
      ruleId: "rule-wifi-password",
      response: "Consulte a recepção.",
      category: "faq",
      version: 1,
    });
  });

  it("uses only active rules and matches normalized whole phrases", async () => {
    await expect(findApprovedKnowledge("Olá, vocês têm wi fi nos quartos?")).resolves.toEqual({
      ruleId: "rule-wifi",
      response: "Temos Wi-Fi.",
      category: "faq",
      version: 1,
    });
    expect(prisma.chatbotRule.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        isActive: true,
        audience: "public",
        approvedAt: { not: null },
      },
    }));
  });

  it("does not match short triggers inside unrelated words", async () => {
    await expect(findApprovedKnowledge("Quero saber o valor da noite")).resolves.toBeNull();
  });

  it("returns null for empty input", async () => {
    await expect(findApprovedKnowledge("   ")).resolves.toBeNull();
    expect(prisma.chatbotRule.findMany).not.toHaveBeenCalled();
  });
});
