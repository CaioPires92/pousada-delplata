import prisma from "@/lib/prisma";
import { getActiveMessagingHealth } from "@/lib/crm/operationalMetrics";

export type RolloutStability = {
  approved: boolean;
  reasons: string[];
  metrics: {
    eventFailures: number;
    failedJobs: number;
    openDeadLetters: number;
    messagingStatus: string;
  };
};

export async function evaluateRolloutStability(
  since: Date,
  client: typeof prisma = prisma,
  messagingHealthCheck = getActiveMessagingHealth,
): Promise<RolloutStability> {
  const [eventFailures, failedJobs, openDeadLetters, messaging] = await Promise.all([
    client.internalActionLog.count({
      where: {
        action: { in: ["WhatsAppSendFailed", "WebhookProcessingFailed", "AutomationJobFailed"] },
        createdAt: { gte: since },
      },
    }),
    client.automationQueueJob.count({
      where: { status: "failed", finishedAt: { gte: since } },
    }),
    client.deadLetterQueueItem.count({
      where: { status: "open" },
    }),
    messagingHealthCheck(),
  ]);
  const reasons: string[] = [];
  if (messaging.status !== "healthy") reasons.push("messaging_provider_unhealthy");
  if (eventFailures > 0) reasons.push("operational_event_failures");
  if (failedJobs > 0) reasons.push("automation_jobs_failed");
  if (openDeadLetters > 0) reasons.push("dead_letters_open");

  return {
    approved: reasons.length === 0,
    reasons,
    metrics: {
      eventFailures,
      failedJobs,
      openDeadLetters,
      messagingStatus: messaging.status,
    },
  };
}
