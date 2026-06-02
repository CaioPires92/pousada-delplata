import prisma from "@/lib/prisma";

import { crmLog } from "@/lib/crm/logger";

export type QueueAction = "SEND_WHATSAPP_MESSAGE";

type QueuePayload = {
  target?: string;
  text?: string;
};

function parsePayload(payloadJson: string): QueuePayload {
  try {
    const parsed = JSON.parse(payloadJson) as QueuePayload;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function enqueueAutomationJob(input: {
  conversationId: string;
  action: QueueAction;
  payload: Record<string, unknown>;
}) {
  return prisma.automationQueueJob.create({
    data: {
      conversationId: input.conversationId,
      action: input.action,
      payloadJson: JSON.stringify(input.payload),
      status: "pending",
    },
  });
}

async function moveToDeadLetter(input: {
  conversationId?: string;
  action: string;
  source: string;
  reason: string;
  payloadJson: string;
}) {
  await prisma.deadLetterQueueItem.create({
    data: {
      conversationId: input.conversationId,
      source: input.source,
      action: input.action,
      reason: input.reason,
      payloadJson: input.payloadJson,
      status: "open",
    },
  });
}

export async function processNextAutomationJobForConversation(
  conversationId: string,
  runner: (job: {
    id: string;
    action: string;
    payload: QueuePayload;
  }) => Promise<void>
) {
  const existingProcessing = await prisma.automationQueueJob.findFirst({
    where: {
      conversationId,
      status: "processing",
    },
    select: { id: true },
  });

  if (existingProcessing) {
    return { ok: true as const, queued: true as const, processed: false as const };
  }

  const candidate = await prisma.automationQueueJob.findFirst({
    where: {
      conversationId,
      status: "pending",
    },
    orderBy: { createdAt: "asc" },
  });

  if (!candidate) {
    return { ok: true as const, queued: false as const, processed: false as const };
  }

  const claimed = await prisma.automationQueueJob.updateMany({
    where: { id: candidate.id, status: "pending" },
    data: {
      status: "processing",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0) {
    return { ok: true as const, queued: true as const, processed: false as const };
  }

  const payload = parsePayload(candidate.payloadJson);

  try {
    await runner({ id: candidate.id, action: candidate.action, payload });

    await prisma.automationQueueJob.update({
      where: { id: candidate.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        lastError: null,
      },
    });

    return { ok: true as const, queued: false as const, processed: true as const, jobId: candidate.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    const failed = await prisma.automationQueueJob.update({
      where: { id: candidate.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        lastError: message,
      },
    });

    await moveToDeadLetter({
      conversationId,
      action: failed.action,
      source: "automation_queue",
      reason: message,
      payloadJson: failed.payloadJson,
    });

    crmLog({
      level: "ERROR",
      action: "AutomationQueueJobFailed",
      message: "Automation queue job moved to dead letter",
      context: {
        jobId: failed.id,
        conversationId,
      },
    });

    return { ok: false as const, queued: false as const, processed: true as const, jobId: candidate.id, error: message };
  }
}

export async function replayDeadLetterItem(input: {
  deadLetterId: string;
}) {
  const item = await prisma.deadLetterQueueItem.findUnique({
    where: { id: input.deadLetterId },
  });

  if (!item) {
    return { ok: false as const, error: "dead_letter_not_found" };
  }

  const payload = parsePayload(item.payloadJson);
  const conversationId = item.conversationId;

  if (!conversationId) {
    return { ok: false as const, error: "missing_conversation_id" };
  }

  const job = await enqueueAutomationJob({
    conversationId,
    action: item.action as QueueAction,
    payload,
  });

  await prisma.deadLetterQueueItem.update({
    where: { id: item.id },
    data: {
      status: "replayed",
      replayedAt: new Date(),
    },
  });

  return { ok: true as const, jobId: job.id };
}
