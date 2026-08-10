import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { $transaction: vi.fn() },
}));
vi.mock("@/lib/crm/automationQueue", () => ({ cancelPendingAutomationJobs: vi.fn() }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { cancelPendingAutomationJobs } from "@/lib/crm/automationQueue";
import { recordCrmEvent } from "@/lib/crm/events";
import { cancelCommercialFollowUps } from "@/lib/crm/followUpCancellation";

describe("cancelCommercialFollowUps", () => {
  const tx = {
    pipelineCard: { updateMany: vi.fn() },
    automationQueueJob: { updateMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));
    tx.pipelineCard.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(cancelPendingAutomationJobs).mockResolvedValue(2);
    vi.mocked(recordCrmEvent).mockResolvedValue(null);
  });

  it("clears card schedules and queued replies after a customer response", async () => {
    await expect(cancelCommercialFollowUps({
      conversationId: "conversation-1",
      contactId: "contact-1",
      reason: "customer_replied",
      origin: "webhook",
    })).resolves.toEqual({ cards: 1, queueJobs: 2 });

    expect(tx.pipelineCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conversationId: "conversation-1",
        contactId: "contact-1",
        followUpAt: { not: null },
      }),
      data: expect.objectContaining({ followUpAt: null }),
    }));
    expect(cancelPendingAutomationJobs).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conversation-1",
      reason: "customer_replied",
      journeyTypes: ["commercial_followup"],
      client: tx,
    }));
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "CommercialFollowUpsCancelled",
      metadata: expect.objectContaining({ clearedCards: 1, cancelledQueueJobs: 2 }),
    }));
  });

  it("does not create audit noise when nothing was scheduled", async () => {
    tx.pipelineCard.updateMany.mockResolvedValue({ count: 0 });
    vi.mocked(cancelPendingAutomationJobs).mockResolvedValue(0);

    await cancelCommercialFollowUps({
      conversationId: "conversation-1",
      contactId: "contact-1",
      reason: "reservation_started",
      origin: "system",
    });

    expect(recordCrmEvent).not.toHaveBeenCalled();
  });
});
