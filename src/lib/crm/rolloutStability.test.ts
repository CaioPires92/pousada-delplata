import { describe, expect, it, vi } from "vitest";

import { evaluateRolloutStability } from "./rolloutStability";

function clientWithCounts(eventFailures: number, failedJobs: number, openDeadLetters: number) {
  return {
    internalActionLog: { count: vi.fn().mockResolvedValue(eventFailures) },
    automationQueueJob: { count: vi.fn().mockResolvedValue(failedJobs) },
    deadLetterQueueItem: { count: vi.fn().mockResolvedValue(openDeadLetters) },
  };
}

describe("rollout operational stability", () => {
  it("approves a healthy period without failures", async () => {
    const client = clientWithCounts(0, 0, 0);

    await expect(evaluateRolloutStability(
      new Date("2026-08-11T12:00:00Z"),
      client as never,
      vi.fn().mockResolvedValue({ provider: "evolution", status: "healthy" }),
    )).resolves.toEqual({
      approved: true,
      reasons: [],
      metrics: { eventFailures: 0, failedJobs: 0, openDeadLetters: 0, messagingStatus: "healthy" },
    });
  });

  it("reports every operational failure that blocks expansion", async () => {
    const since = new Date("2026-08-11T12:00:00Z");
    const client = clientWithCounts(2, 1, 1);

    await expect(evaluateRolloutStability(
      since,
      client as never,
      vi.fn().mockResolvedValue({ provider: "evolution", status: "unhealthy" }),
    )).resolves.toMatchObject({
      approved: false,
      reasons: [
        "messaging_provider_unhealthy",
        "operational_event_failures",
        "automation_jobs_failed",
        "dead_letters_open",
      ],
    });
    expect(client.internalActionLog.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ createdAt: { gte: since } }),
    });
    expect(client.deadLetterQueueItem.count).toHaveBeenCalledWith({ where: { status: "open" } });
  });
});
