import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTOMATION_CLARIFICATION_MESSAGE,
  DEFAULT_AUTOMATION_HANDOFF_MESSAGE,
  decideAutomationHandoff,
} from "./handoffPolicy";

describe("automation handoff policy", () => {
  it("asks for one clarification before handing an unknown request to a human", () => {
    expect(decideAutomationHandoff("Quero um gás para entregar aqui na rua tal")).toMatchObject({
      shouldHandoff: false,
      reason: "unknown_intent",
      message: DEFAULT_AUTOMATION_CLARIFICATION_MESSAGE,
    });

    expect(decideAutomationHandoff(
      "Ainda quero um gás",
      undefined,
      { consecutiveFailures: 1 },
    )).toMatchObject({
      shouldHandoff: true,
      reason: "repeated_failure",
      message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE,
    });
  });

  it("uses a short, natural handoff message", () => {
    expect(DEFAULT_AUTOMATION_HANDOFF_MESSAGE).toBe(
      "Só um momento, por favor. Vou confirmar essa informação com nossa equipe e retorno por aqui."
    );
  });

  it.each([
    ["Quero falar com um atendente", "human_requested"],
    ["Tenho uma reclamação urgente", "complaint_or_emergency"],
    ["Quero cancelar e pedir reembolso", "cancellation_or_refund"],
  ])("hands off critical message %s", (message, reason) => {
    expect(decideAutomationHandoff(message)).toMatchObject({ shouldHandoff: true, reason });
  });

  it("hands off a model decision below the safe confidence threshold", () => {
    expect(decideAutomationHandoff(
      "Tem alguma informação sobre isso?",
      undefined,
      { confidence: 0.3 },
    )).toMatchObject({ shouldHandoff: true, reason: "low_confidence" });
  });

  it("keeps valid and partial quote inputs in deterministic automation", () => {
    expect(decideAutomationHandoff("Quanto fica de 12 a 13 de setembro para um casal?")).toEqual({
      shouldHandoff: false,
    });
    expect(decideAutomationHandoff("12 e 13 de setembro")).toEqual({ shouldHandoff: false });
  });
});
