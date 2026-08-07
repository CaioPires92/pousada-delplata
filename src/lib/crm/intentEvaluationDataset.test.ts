import { describe, expect, it } from "vitest";

import { decideAutomationHandoff } from "@/lib/crm/handoffPolicy";
import { INTENT_EVALUATION_DATASET } from "@/lib/crm/intentEvaluationDataset";
import { parseCrmIntent } from "@/lib/crm/intentParser";

const referenceDate = new Date("2026-08-07T12:00:00.000Z");

describe("anonymized intent evaluation dataset", () => {
  it("has unique identifiers and no obvious email, CPF or phone PII", () => {
    const ids = INTENT_EVALUATION_DATASET.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(INTENT_EVALUATION_DATASET.length).toBeGreaterThanOrEqual(20);

    for (const item of INTENT_EVALUATION_DATASET) {
      expect(item.message).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
      expect(item.message).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
      expect(item.message).not.toMatch(/\b(?:\d[ -]?){10,13}\b/);
    }
  });

  it.each(INTENT_EVALUATION_DATASET)("classifies $id according to the reviewed expectation", item => {
    const parsed = parseCrmIntent(item.message, referenceDate);
    expect(parsed.intent).toBe(item.expectedIntent);
    for (const issueCode of item.expectedIssueCodes ?? []) {
      expect(parsed.validationIssues.map(issue => issue.code)).toContain(issueCode);
    }
    expect(decideAutomationHandoff(item.message, parsed).shouldHandoff).toBe(item.expectedHandoff);
  });

  it("hands off every critical or adversarial case", () => {
    const criticalCases = INTENT_EVALUATION_DATASET.filter(item =>
      item.tags.includes("critical") || item.tags.includes("adversarial")
    );
    expect(criticalCases.length).toBeGreaterThan(0);
    for (const item of criticalCases) {
      expect(decideAutomationHandoff(item.message, parseCrmIntent(item.message, referenceDate)).shouldHandoff).toBe(true);
    }
  });
});
