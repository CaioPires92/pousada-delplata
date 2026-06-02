import { describe, expect, it } from "vitest";

import { buildQuoteFlowState } from "./conversationFlow";

describe("buildQuoteFlowState", () => {
  it("creates quote flow state from parsed message", () => {
    const result = buildQuoteFlowState("Valor de 15/06 a 17/06 para 2 adultos");

    expect(result).toMatchObject({
      currentFlow: "quote",
      flowStep: "ready_to_quote",
      shouldTouchAutomationTime: true,
    });

    expect(result.flowDataJson).toContain("2026-06-15");
  });

  it("keeps non-quote flow untouched", () => {
    const result = buildQuoteFlowState("bom dia", {
      currentFlow: "quote",
      flowStep: "waiting_checkout",
      flowDataJson: '{"checkin":"2026-06-15"}',
    });

    expect(result).toEqual({
      currentFlow: "quote",
      flowStep: "waiting_checkout",
      flowDataJson: '{"checkin":"2026-06-15"}',
      shouldTouchAutomationTime: false,
    });
  });

  it("merges previously collected data when message is partial", () => {
    const result = buildQuoteFlowState("quanto fica para 2 adultos?", {
      currentFlow: "quote",
      flowStep: "waiting_adults",
      flowDataJson: '{"checkin":"2026-06-15","checkout":"2026-06-17"}',
    });

    expect(result.currentFlow).toBe("quote");
    expect(result.flowStep).toBe("ready_to_quote");
    expect(result.flowDataJson).toContain("2026-06-15");
    expect(result.flowDataJson).toContain('"adults":2');
  });
});
