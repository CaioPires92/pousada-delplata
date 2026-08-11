import { describe, expect, it, vi } from "vitest";
import { getOperationalAlerts } from "./operationalAlerts";

describe("getOperationalAlerts", () => {
  it("covers webhook, queue, provider, AI, Map and dead-letter signals", async () => {
    const at = new Date("2026-08-11T15:00:00.000Z");
    const findLogs = vi.fn()
      .mockResolvedValueOnce([{ createdAt: at }])
      .mockResolvedValueOnce([{ metadataJson: '{"result":"fallback_timeout"}', createdAt: at }])
      .mockResolvedValueOnce([{ createdAt: at }]);
    const client = {
      internalActionLog: { findMany: findLogs },
      automationQueueJob: { findMany: vi.fn().mockResolvedValue([{ startedAt: at, createdAt: at }]) },
      deadLetterQueueItem: { findMany: vi.fn().mockResolvedValue([{ createdAt: at }]) },
    };
    const alerts = await getOperationalAlerts(
      at,
      client as never,
      vi.fn().mockResolvedValue({ provider: "evolution", status: "unhealthy" }),
    );
    expect(alerts.map(alert => alert.code)).toEqual([
      "MESSAGING_PROVIDER_UNHEALTHY", "WEBHOOK_FAILING", "QUEUE_STUCK", "AI_DEGRADED", "MAP_UNAVAILABLE", "DEAD_LETTER_OPEN",
    ]);
  });

  it("returns no alert while every monitored subsystem is healthy", async () => {
    const client = {
      internalActionLog: { findMany: vi.fn().mockResolvedValue([]) },
      automationQueueJob: { findMany: vi.fn().mockResolvedValue([]) },
      deadLetterQueueItem: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(getOperationalAlerts(
      new Date(), client as never, vi.fn().mockResolvedValue({ provider: "evolution", status: "healthy" }),
    )).resolves.toEqual([]);
  });
});
