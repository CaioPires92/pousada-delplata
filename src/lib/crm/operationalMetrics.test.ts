import { describe, expect, it, vi } from "vitest";
import { getCrmOperationalMetrics } from "./operationalMetrics";

describe("getCrmOperationalMetrics", () => {
  it("calculates health, latency, errors and configured AI cost", async () => {
    process.env.CRM_AI_INPUT_USD_PER_1M_TOKENS = "2";
    process.env.CRM_AI_OUTPUT_USD_PER_1M_TOKENS = "8";
    const client = {
      internalActionLog: {
        findMany: vi.fn().mockResolvedValue([
          { metadataJson: JSON.stringify({ latencyMs: 100, inputTokens: 1000, outputTokens: 100 }) },
          { metadataJson: JSON.stringify({ latencyMs: 300, inputTokens: 500, outputTokens: 50 }) },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
      automationQueueJob: { count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2) },
      deadLetterQueueItem: { count: vi.fn().mockResolvedValue(0) },
    };
    const metrics = await getCrmOperationalMetrics(
      new Date("2026-08-01"),
      new Date("2026-08-11"),
      client as never,
      vi.fn().mockResolvedValue({ provider: "evolution", status: "healthy", connectionState: "open" }),
    );
    expect(metrics).toMatchObject({
      health: "warning",
      latency: { samples: 2, averageMs: 200, p95Ms: 300 },
      errors: { total: 2, eventFailures: 1, failedJobs: 1 },
      queue: { overdueJobs: 2, openDeadLetters: 0 },
      aiCost: { inputTokens: 1500, outputTokens: 150, estimatedCostUsd: 0.0042, configured: true },
    });
  });

  it("does not invent monetary cost when token prices are absent", async () => {
    delete process.env.CRM_AI_INPUT_USD_PER_1M_TOKENS;
    delete process.env.CRM_AI_OUTPUT_USD_PER_1M_TOKENS;
    const client = {
      internalActionLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      automationQueueJob: { count: vi.fn().mockResolvedValue(0) },
      deadLetterQueueItem: { count: vi.fn().mockResolvedValue(0) },
    };
    await expect(getCrmOperationalMetrics(
      new Date(),
      new Date(),
      client as never,
      vi.fn().mockResolvedValue({ provider: "evolution", status: "healthy", connectionState: "open" }),
    ))
      .resolves.toMatchObject({ health: "healthy", aiCost: { estimatedCostUsd: null, configured: false } });
  });
});
