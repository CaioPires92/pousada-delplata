import { describe, expect, it } from "vitest";

import {
  isQuoteExpired,
  parseFlowDataJson,
  promptForFlowStep,
  shouldExpireQuoteFlow,
  shouldSkipPromptRepeat,
} from "./quoteFlow";

describe("quoteFlow", () => {
  it("parses invalid flow json safely", () => {
    expect(parseFlowDataJson("{")).toEqual({});
  });

  it("returns prompt for known step", () => {
    expect(promptForFlowStep("waiting_adults")?.text).toContain("adultos");
    expect(promptForFlowStep("unknown")).toBeNull();
  });

  it("expires flow after timeout", () => {
    const now = new Date("2026-05-13T15:00:00.000Z");
    const old = new Date("2026-05-13T14:20:00.000Z");
    expect(shouldExpireQuoteFlow(old, now)).toBe(true);
  });

  it("debounces repeated prompt by step", () => {
    const now = new Date("2026-05-13T15:00:00.000Z");
    expect(
      shouldSkipPromptRepeat(
        { lastPromptStep: "waiting_checkout", lastPromptAt: "2026-05-13T14:59:50.000Z" },
        "waiting_checkout",
        now
      )
    ).toBe(true);
  });

  it("blocks missing, invalid and expired quotes at the send boundary", () => {
    const now = new Date("2026-05-13T15:00:00.000Z");

    expect(isQuoteExpired(undefined, now)).toBe(true);
    expect(isQuoteExpired("invalid", now)).toBe(true);
    expect(isQuoteExpired("2026-05-13T14:59:59.999Z", now)).toBe(true);
    expect(isQuoteExpired("2026-05-13T15:00:00.000Z", now)).toBe(true);
    expect(isQuoteExpired("2026-05-13T15:00:00.001Z", now)).toBe(false);
  });
});
