import prisma from "@/lib/prisma";
import { PIPELINE_STAGES } from "@/lib/crm/pipelineStages";

const PROACTIVE_JOURNEYS = ["commercial_followup", "broadcast", "post_stay"];

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
}

export async function getAutomationJourneyMetrics(
  since: Date,
  client: typeof prisma = prisma,
) {
  const proactiveWhere = {
    action: "SEND_WHATSAPP_MESSAGE",
    journeyType: { in: PROACTIVE_JOURNEYS },
  };
  const [sentByConversation, repliedByConversation, cancelledJobs, failedJobs] = await Promise.all([
    client.automationQueueJob.groupBy({
      by: ["conversationId"],
      where: { ...proactiveWhere, status: "completed", finishedAt: { gte: since } },
      _count: { _all: true },
    }),
    client.automationQueueJob.groupBy({
      by: ["conversationId"],
      where: {
        ...proactiveWhere,
        status: "cancelled",
        cancelReason: "customer_replied",
        cancelledAt: { gte: since },
      },
      _count: { _all: true },
    }),
    client.automationQueueJob.count({
      where: { ...proactiveWhere, status: "cancelled", cancelledAt: { gte: since } },
    }),
    client.automationQueueJob.count({
      where: { ...proactiveWhere, status: "failed", finishedAt: { gte: since } },
    }),
  ]);

  const reachedIds = sentByConversation.map(item => item.conversationId);
  const reachedSet = new Set(reachedIds);
  const sentJobs = sentByConversation.reduce((total, item) => total + item._count._all, 0);
  const respondedConversations = repliedByConversation
    .filter(item => reachedSet.has(item.conversationId))
    .length;
  const convertedConversations = reachedIds.length > 0
    ? await client.pipelineCard.count({
        where: {
          conversationId: { in: reachedIds },
          stage: PIPELINE_STAGES.RESERVA_CONFIRMADA,
        },
      })
    : 0;

  return {
    sentJobs,
    reachedConversations: reachedIds.length,
    respondedConversations,
    convertedConversations,
    cancelledJobs,
    failedJobs,
    responseRate: percentage(respondedConversations, reachedIds.length),
    conversionRate: percentage(convertedConversations, reachedIds.length),
  };
}
