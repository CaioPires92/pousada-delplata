import { describe, expect, it } from "vitest";

import { parseAiDecision } from "./aiDecision";

describe("AiDecision schema", () => {
  it("accepts a versioned decision with allowlisted values", () => {
    expect(parseAiDecision({
      schemaVersion: 1,
      intent: "quote",
      confidence: 0.91,
      suggestedAction: "collect_quote_fields",
      reasonCode: "missing_information",
      entities: { checkin: "2026-09-18", adults: 2 },
    })).toMatchObject({ intent: "quote", confidence: 0.91 });
  });

  it.each([
    { schemaVersion: 2, intent: "quote", confidence: 0.9, suggestedAction: "none", reasonCode: "recognized_intent", entities: {} },
    { schemaVersion: 1, intent: "discount", confidence: 0.9, suggestedAction: "none", reasonCode: "recognized_intent", entities: {} },
    { schemaVersion: 1, intent: "quote", confidence: 1.2, suggestedAction: "none", reasonCode: "recognized_intent", entities: {} },
    { schemaVersion: 1, intent: "quote", confidence: 0.9, suggestedAction: "send_discount", reasonCode: "recognized_intent", entities: {} },
    { schemaVersion: 1, intent: "quote", confidence: 0.9, suggestedAction: "none", reasonCode: "recognized_intent", entities: {}, extra: true },
  ])("rejects invalid or non-allowlisted decisions", decision => {
    expect(parseAiDecision(decision)).toBeNull();
  });
});
