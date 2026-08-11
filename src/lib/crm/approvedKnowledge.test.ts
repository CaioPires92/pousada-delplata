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
      { id: "rule-wifi-password", trigger: "senha do Wi-Fi", response: "A senha é pousada151.", category: "faq", version: 2 },
      { id: "rule-bed", trigger: "cama", response: "Vou confirmar o tipo de cama.", category: "acomodacoes", version: 1 },
      { id: "rule-bed-linen", trigger: "roupa de cama", response: "Vou confirmar a roupa de cama.", category: "acomodacoes", version: 1 },
      { id: "rule-window", trigger: "janela", response: "Somente os térreos não possuem janelas.", category: "acomodacoes", version: 2 },
      { id: "rule-windows", trigger: "janelas", response: "Somente os térreos não possuem janelas.", category: "acomodacoes", version: 2 },
      { id: "rule-parking", trigger: "estacionamento", response: "O estacionamento é gratuito.", category: "estrutura", version: 2 },
      { id: "rule-voltage", trigger: "voltagem", response: "A voltagem varia por acomodação.", category: "acomodacoes", version: 1 },
    ] as never);
  });

  it("answers multiple FAQ questions once and in message order", async () => {
    await expect(findApprovedKnowledge(
      "qual a senha do wifi, tem estacionamento, qual a voltagem das tomadas, os quartos possuem janelas",
    )).resolves.toEqual({
      ruleId: "rule-wifi-password,rule-parking,rule-voltage,rule-windows",
      response: [
        "1. A senha é pousada151.",
        "2. O estacionamento é gratuito.",
        "3. A voltagem varia por acomodação.",
        "4. Somente os térreos não possuem janelas.",
      ].join("\n\n"),
      category: "multiple",
      version: 2,
    });
  });

  it("keeps separate bed questions while suppressing overlapping generic matches", async () => {
    await expect(findApprovedKnowledge("Tem roupa de cama e a cama é queen?")).resolves.toMatchObject({
      ruleId: "rule-bed-linen,rule-bed",
      response: "1. Vou confirmar a roupa de cama.\n\n2. Vou confirmar o tipo de cama.",
      category: "multiple",
    });
  });

  it.each([
    "O quarto possui janela?",
    "Os quartos possuem janelas?",
  ])("routes window questions safely in %s", async message => {
    const result = await findApprovedKnowledge(message);

    expect(result).toMatchObject({
      response: "Somente os térreos não possuem janelas.",
      category: "acomodacoes",
    });
  });

  it("prefers the specific bed-linen answer over the generic bed answer", async () => {
    await expect(findApprovedKnowledge("Vocês fornecem roupa de cama?")).resolves.toEqual({
      ruleId: "rule-bed-linen",
      response: "Vou confirmar a roupa de cama.",
      category: "acomodacoes",
      version: 1,
    });
  });

  it.each([
    "A cama é queen?",
    "Tem cama king?",
    "Qual é o tamanho da cama?",
  ])("routes bed configuration questions safely in %s", async message => {
    await expect(findApprovedKnowledge(message)).resolves.toEqual({
      ruleId: "rule-bed",
      response: "Vou confirmar o tipo de cama.",
      category: "acomodacoes",
      version: 1,
    });
  });

  it.each([
    "Qual a senha do wifi?",
    "senha do wi-fi",
    "Pode informar a senha do wi fi?",
  ])("normalizes Wi-Fi spelling variants in %s", async message => {
    await expect(findApprovedKnowledge(message)).resolves.toEqual({
      ruleId: "rule-wifi-password",
      response: "A senha é pousada151.",
      category: "faq",
      version: 2,
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
