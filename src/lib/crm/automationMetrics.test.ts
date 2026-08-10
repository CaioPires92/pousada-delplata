import { describe, expect, it, vi } from "vitest";

import { getAutomationJourneyMetrics } from "./automationMetrics";

describe("automation journey metrics", () => {
  it("calculates sends, responses, conversions and cancellations by reached conversation", async () => {
    const groupBy = vi.fn()
      .mockResolvedValueOnce([
        { conversationId: "conversation-1", _count: { _all: 2 } },
        { conversationId: "conversation-2", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { conversationId: "conversation-1", _count: { _all: 1 } },
        { conversationId: "not-reached", _count: { _all: 1 } },
      ]);
    const count = vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    const pipelineCount = vi.fn().mockResolvedValue(1);

    const result = await getAutomationJourneyMetrics(
      new Date("2026-08-03T18:00:00.000Z"),
      {
        automationQueueJob: { groupBy, count },
        pipelineCard: { count: pipelineCount },
      } as never,
    );

    expect(result).toEqual({
      sentJobs: 3,
      reachedConversations: 2,
      respondedConversations: 1,
      convertedConversations: 1,
      cancelledJobs: 4,
      failedJobs: 1,
      responseRate: 50,
      conversionRate: 50,
    });
  });

  it("returns zero rates without reached conversations", async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const pipelineCount = vi.fn();

    await expect(getAutomationJourneyMetrics(new Date(), {
      automationQueueJob: { groupBy, count },
      pipelineCard: { count: pipelineCount },
    } as never)).resolves.toMatchObject({
      reachedConversations: 0,
      responseRate: 0,
      conversionRate: 0,
    });
    expect(pipelineCount).not.toHaveBeenCalled();
  });
});
