import { describe, expect, it } from "vitest";

import { decideAutomationHandoff } from "./handoffPolicy";

describe("automation handoff policy", () => {
  it("hands unknown service requests to a human without inventing an answer", () => {
    expect(decideAutomationHandoff("Quero um gás para entregar aqui na rua tal")).toMatchObject({
      shouldHandoff: true,
      reason: "unknown_intent",
    });
  });

  it.each([
    ["Quero falar com um atendente", "human_requested"],
    ["Tenho uma reclamação urgente", "complaint_or_emergency"],
    ["Quero cancelar e pedir reembolso", "cancellation_or_refund"],
  ])("hands off critical message %s", (message, reason) => {
    expect(decideAutomationHandoff(message)).toMatchObject({ shouldHandoff: true, reason });
  });

  it("keeps valid and partial quote inputs in deterministic automation", () => {
    expect(decideAutomationHandoff("Quanto fica de 12 a 13 de setembro para um casal?")).toEqual({
      shouldHandoff: false,
    });
    expect(decideAutomationHandoff("12 e 13 de setembro")).toEqual({ shouldHandoff: false });
  });
});
