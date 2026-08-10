import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import {
  cancelPendingAutomationJobs,
  enqueueAutomationJob,
  processNextAutomationJobForConversation,
  replayDeadLetterItem,
} from "./automationQueue";

vi.mock("@/lib/prisma", () => ({
  default: {
    automationQueueJob: {
      create: vi.fn(),
      upsert: vi.fn(),
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
    expect(prisma.automationQueueJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: "conv-1",
        journeyType: null,
        dedupeKey: null,
        scheduledAt: expect.any(Date),
        status: "pending",
      }),
    });
  });

  it("deduplicates a journey step by its stable key", async () => {
    vi.mocked(prisma.automationQueueJob.upsert).mockResolvedValue({ id: "job-existing" } as any);
    const scheduledAt = new Date("2026-08-10T18:00:00.000Z");

    await enqueueAutomationJob({
      conversationId: "conv-1",
      action: "SEND_WHATSAPP_MESSAGE",
      payload: { target: "551199", text: "Lembrete" },
      journeyType: "commercial_followup",
      dedupeKey: "followup:conv-1:step-1",
      scheduledAt,
    });

    expect(prisma.automationQueueJob.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: "followup:conv-1:step-1" },
      create: expect.objectContaining({
        journeyType: "commercial_followup",
        scheduledAt,
      }),
      update: {},
    }));
    expect(prisma.automationQueueJob.create).not.toHaveBeenCalled();
  });

  it("cancels only pending WhatsApp sends and records a bounded reason", async () => {
    vi.mocked(prisma.automationQueueJob.updateMany).mockResolvedValue({ count: 2 });
    const now = new Date("2026-08-06T12:00:00.000Z");

    await expect(cancelPendingAutomationJobs({
      conversationId: "conv-1",
      reason: "human_takeover",
      now,
    })).resolves.toBe(2);

    expect(prisma.automationQueueJob.updateMany).toHaveBeenCalledWith({
      where: {
        conversationId: "conv-1",
        action: "SEND_WHATSAPP_MESSAGE",
        status: "pending",
      },
      data: {
        status: "cancelled",
        cancelledAt: now,
        cancelReason: "human_takeover",
        finishedAt: now,
      },
    });
  });

  it("marks a claimed job cancelled when the runner revokes authorization", async () => {
    vi.mocked(prisma.automationQueueJob.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "job-cancelled",
        conversationId: "conv-1",
        action: "SEND_WHATSAPP_MESSAGE",
        payloadJson: "{\"target\":\"551199\",\"text\":\"oi\"}",
      } as any);
    vi.mocked(prisma.automationQueueJob.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await processNextAutomationJobForConversation("conv-1", async () => ({
      cancelled: true,
      reason: "human_takeover_or_automation_paused",
    }));

    expect(result).toMatchObject({ ok: true, cancelled: true, processed: false });
    expect(prisma.automationQueueJob.update).not.toHaveBeenCalled();
    expect(prisma.automationQueueJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: "job-cancelled", status: "processing" },
      data: expect.objectContaining({
        status: "cancelled",
        cancelReason: "human_takeover_or_automation_paused",
      }),
    });
  });

  it("returns a claimed job to pending when quiet hours require rescheduling", async () => {
    const scheduledAt = new Date("2026-08-11T11:00:00.000Z");
    vi.mocked(prisma.automationQueueJob.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "job-quiet",
        conversationId: "conv-1",
        action: "SEND_WHATSAPP_MESSAGE",
        journeyType: "commercial_followup",
        payloadJson: "{\"target\":\"551199\",\"text\":\"oi\"}",
      } as any);
    vi.mocked(prisma.automationQueueJob.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await processNextAutomationJobForConversation("conv-1", async () => ({
      rescheduled: true,
      reason: "quiet_hours",
      scheduledAt,
    }));

    expect(result).toMatchObject({ rescheduled: true, processed: false, queued: true });
    expect(prisma.automationQueueJob.updateMany).toHaveBeenLastCalledWith({
      where: { id: "job-quiet", status: "processing" },
      data: {
        status: "pending",
        scheduledAt,
        startedAt: null,
        attempts: { decrement: 1 },
      },
    });
  });

  it("skips processing when another job is in processing status", async () => {
    vi.mocked(prisma.automationQueueJob.findFirst).mockResolvedValueOnce({ id: "job-processing" } as any);

    const result = await processNextAutomationJobForConversation("conv-1", async () => {
      throw new Error("should not run");
    });

    expect(result.ok).toBe(true);
    expect(result.processed).toBe(false);
  });

  it("does not claim a job scheduled for the future", async () => {
    const now = new Date("2026-08-10T18:00:00.000Z");
    vi.mocked(prisma.automationQueueJob.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await processNextAutomationJobForConversation(
      "conv-1",
      async () => {
        throw new Error("should not run");
      },
      { now },
    );

    expect(result).toMatchObject({ queued: false, processed: false });
    expect(prisma.automationQueueJob.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "pending",
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: now } },
        ],
      }),
    }));
    expect(prisma.automationQueueJob.updateMany).not.toHaveBeenCalled();
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
