import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildQuoteFlowState } from "./conversationFlow";

describe("buildQuoteFlowState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("asks only for invalid dates and does not reuse stale quote dates", () => {
    const result = buildQuoteFlowState("01/01/2026 a 01/01/23, 2 adultos", {
      currentFlow: "quote",
      flowStep: "ready_to_quote",
      flowDataJson: '{"checkin":"2026-06-15","checkout":"2026-06-17","adults":2}',
    });

    expect(result.flowStep).toBe("invalid_checkin");
    expect(JSON.parse(result.flowDataJson ?? "{}")).toMatchObject({
      adults: 2,
      validationIssue: { field: "checkin", code: "past_date" },
    });
    expect(JSON.parse(result.flowDataJson ?? "{}")).not.toHaveProperty("checkin");
    expect(JSON.parse(result.flowDataJson ?? "{}")).not.toHaveProperty("checkout");
  });

  it("accepts a date-only reply while an existing quote flow is waiting", () => {
    const result = buildQuoteFlowState("17/06", {
      currentFlow: "quote",
      flowStep: "waiting_checkout",
      flowDataJson: '{"checkin":"2026-06-15"}',
    });

    expect(result.flowStep).toBe("waiting_adults");
    expect(result.flowDataJson).toContain('"checkout":"2026-06-17"');
  });

  it("preserves prompt debounce metadata while merging a partial reply", () => {
    const result = buildQuoteFlowState("casal", {
      currentFlow: "quote",
      flowStep: "waiting_checkin",
      flowDataJson: '{"lastPromptStep":"waiting_checkin","lastPromptAt":"2026-01-10T11:59:55.000Z"}',
    });

    expect(JSON.parse(result.flowDataJson ?? "{}")).toMatchObject({
      adults: 2,
      lastPromptStep: "waiting_checkin",
      lastPromptAt: "2026-01-10T11:59:55.000Z",
    });
  });
});
