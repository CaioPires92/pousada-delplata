import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { PIPELINE_STAGE_ORDER, PIPELINE_STAGES } from "@/lib/crm/pipelineStages";

function periodStart(scope: "daily" | "weekly") {
  const now = new Date();
  if (scope === "daily") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

type JsonRow = {
  [key: string]: unknown;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = (url.searchParams.get("scope") === "daily" ? "daily" : "weekly") as "daily" | "weekly";
    const since = periodStart(scope);

    const [
      cardsCreated,
      cardsConfirmed,
      cardsLost,
      cardsBySource,
      cardsByLossReason,
      allActiveCards,
      quoteSentLogs,
      reservationStartedLogs,
      firstGuestMessages,
      firstHumanReplies,
    ] = await Promise.all([
      prisma.pipelineCard.count({ where: { createdAt: { gte: since } } }),
      prisma.pipelineCard.count({ where: { createdAt: { gte: since }, stage: PIPELINE_STAGES.RESERVA_CONFIRMADA } }),
      prisma.pipelineCard.count({ where: { createdAt: { gte: since }, stage: PIPELINE_STAGES.PERDIDO } }),
      prisma.pipelineCard.groupBy({ by: ["source"], where: { createdAt: { gte: since } }, _count: { source: true } }),
      prisma.pipelineCard.groupBy({ by: ["lostReason"], where: { createdAt: { gte: since }, lostReason: { not: null } }, _count: { lostReason: true } }),
      prisma.pipelineCard.groupBy({ by: ["stage"], where: { NOT: { stage: "perdido" } }, _count: { stage: true } }),
      prisma.internalActionLog.count({ where: { action: "QuoteSent", createdAt: { gte: since } } }),
      prisma.internalActionLog.count({ where: { action: "ReservationStarted", createdAt: { gte: since } } }),
      prisma.$queryRaw<JsonRow[]>`
        SELECT conversationId, MIN(sentAt) as firstGuestAt
        FROM Message
        WHERE senderType = 'guest' AND sentAt >= ${since}
        GROUP BY conversationId
      `,
      prisma.$queryRaw<JsonRow[]>`
        SELECT conversationId, MIN(sentAt) as firstHumanAt
        FROM Message
        WHERE senderType IN ('human','bot') AND sentAt >= ${since}
        GROUP BY conversationId
      `,
    ]);

    const firstReplyMap = new Map<string, Date>();
    for (const row of firstHumanReplies) {
      const id = typeof row.conversationId === "string" ? row.conversationId : null;
      const dtRaw = row.firstHumanAt;
      if (!id || !dtRaw) continue;
      const dt = new Date(String(dtRaw));
      if (!Number.isNaN(dt.getTime())) firstReplyMap.set(id, dt);
    }

    const responseTimesMs: number[] = [];
    for (const row of firstGuestMessages) {
      const id = typeof row.conversationId === "string" ? row.conversationId : null;
      const dtRaw = row.firstGuestAt;
      if (!id || !dtRaw) continue;
      const guestAt = new Date(String(dtRaw));
      const humanAt = firstReplyMap.get(id);
      if (!humanAt || Number.isNaN(guestAt.getTime())) continue;
      if (humanAt >= guestAt) responseTimesMs.push(humanAt.getTime() - guestAt.getTime());
    }

    const avgResponseMinutes = responseTimesMs.length > 0
      ? Math.round((responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length) / 60000)
      : null;

    const conversionRate = cardsCreated > 0 ? Number(((cardsConfirmed / cardsCreated) * 100).toFixed(2)) : 0;
    const quoteToReservationRate = quoteSentLogs > 0 ? Number(((reservationStartedLogs / quoteSentLogs) * 100).toFixed(2)) : 0;

    const funnel = PIPELINE_STAGE_ORDER.map(stage => ({
      stage,
      count: allActiveCards.find(item => item.stage === stage)?._count.stage ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      scope,
      since: since.toISOString(),
      metrics: {
        cardsCreated,
        cardsConfirmed,
        cardsLost,
        conversionRate,
        avgResponseMinutes,
        quoteSent: quoteSentLogs,
        reservationStarted: reservationStartedLogs,
        quoteToReservationRate,
      },
      leadsBySource: cardsBySource.map(item => ({ source: item.source ?? "unknown", count: item._count.source })),
      lostReasons: cardsByLossReason.map(item => ({ reason: item.lostReason ?? "sem motivo", count: item._count.lostReason })),
      funnel,
    });
  } catch (error) {
    console.error("[CRM_DASHBOARD] erro ao calcular métricas:", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
