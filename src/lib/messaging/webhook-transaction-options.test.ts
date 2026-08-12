import { describe, expect, it } from "vitest";

import { webhookTransactionOptions, webhookTransactionTimeoutMs } from "./webhook-transaction-options";

describe("webhook transaction options", () => {
  it("uses a bounded timeout above Prisma's interactive transaction default", () => {
    expect(webhookTransactionOptions(undefined)).toEqual({ maxWait: 5_000, timeout: 15_000 });
  });

  it("clamps invalid, short and excessive configuration", () => {
    expect(webhookTransactionTimeoutMs("invalid")).toBe(15_000);
    expect(webhookTransactionTimeoutMs("1000")).toBe(5_000);
    expect(webhookTransactionTimeoutMs("12000")).toBe(12_000);
    expect(webhookTransactionTimeoutMs("60000")).toBe(30_000);
  });
});
