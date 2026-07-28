import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import {
  enqueueAutomationJob,
  processNextAutomationJobForConversation,
  replayDeadLetterItem,
} from "./automationQueue";

vi.mock("@/lib/prisma", () => ({
  default: {
    automationQueueJob: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    deadLetterQueueItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crm/logger", () => ({
  crmLog: vi.fn(),
}));

describe("automationQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues a pending job", async () => {
    vi.mocked(prisma.automationQueueJob.create).mockResolvedValue({ id: "job-1" } as any);

    const job = await enqueueAutomationJob({
      conversationId: "conv-1",
      action: "SEND_WHATSAPP_MESSAGE",
      payload: { target: "551199@s.whatsapp.net", text: "oi" },
    });

    expect(job).toEqual({ id: "job-1" });
  });

  it("skips processing when another job is in processing status", async () => {
    vi.mocked(prisma.automationQueueJob.findFirst).mockResolvedValueOnce({ id: "job-processing" } as any);

    const result = await processNextAutomationJobForConversation("conv-1", async () => {
      throw new Error("should not run");
    });

    expect(result.ok).toBe(true);
    expect(result.processed).toBe(false);
  });

  it("replays dead letter by creating queue job and marking replayed", async () => {
    vi.mocked(prisma.deadLetterQueueItem.findUnique).mockResolvedValue({
      id: "dlq-1",
      conversationId: "conv-1",
      action: "SEND_WHATSAPP_MESSAGE",
      payloadJson: "{\"target\":\"551199@s.whatsapp.net\",\"text\":\"oi\"}",
    } as any);
    vi.mocked(prisma.automationQueueJob.create).mockResolvedValue({ id: "job-2" } as any);

    const result = await replayDeadLetterItem({ deadLetterId: "dlq-1" });

    expect(result).toEqual({ ok: true, jobId: "job-2" });
    expect(prisma.deadLetterQueueItem.update).toHaveBeenCalled();
  });

  it("moves a failed send to dead letter with a sanitized bounded reason", async () => {
    vi.mocked(prisma.automationQueueJob.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "job-failed",
        conversationId: "conv-1",
        action: "SEND_WHATSAPP_MESSAGE",
        payloadJson: "{\"target\":\"551199\",\"text\":\"oi\"}",
      } as any);
    vi.mocked(prisma.automationQueueJob.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.automationQueueJob.update).mockResolvedValue({
      id: "job-failed",
      action: "SEND_WHATSAPP_MESSAGE",
      payloadJson: "{\"target\":\"551199\",\"text\":\"oi\"}",
    } as any);

    await processNextAutomationJobForConversation("conv-1", async () => {
      throw new Error(`Bearer secret-token access_token=private-value ${"x".repeat(600)}`);
    });

    expect(prisma.deadLetterQueueItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "automation_queue",
        action: "SEND_WHATSAPP_MESSAGE",
        reason: expect.not.stringContaining("secret-token"),
      }),
    });
    const reason = vi.mocked(prisma.deadLetterQueueItem.create).mock.calls[0][0].data.reason;
    expect(reason).toContain("Bearer [REDACTED]");
    expect(reason).toContain("access_token=[REDACTED]");
    expect(reason.length).toBeLessThanOrEqual(500);
  });
});
