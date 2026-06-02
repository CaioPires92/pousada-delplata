import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export async function POST(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getBearerToken(request);

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const stage = asNonEmptyString(body?.stage);
  const source = asNonEmptyString(body?.source);
  const fromDate = asNonEmptyString(body?.fromDate);
  const toDate = asNonEmptyString(body?.toDate);
  const action = asNonEmptyString(body?.action);

  const dateFilter = {
    ...(fromDate ? { gte: new Date(fromDate) } : {}),
    ...(toDate ? { lte: new Date(toDate) } : {}),
  };

  const cards = await prisma.pipelineCard.findMany({
    where: {
      ...(stage ? { stage } : {}),
      ...(source ? { source } : {}),
      ...(fromDate || toDate ? { createdAt: dateFilter } : {}),
      contact: {
        optOutAt: null,
      },
    },
    take: 200,
    orderBy: { updatedAt: "desc" },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          source: true,
          optInWhatsapp: true,
        },
      },
      conversation: {
        select: {
          id: true,
        },
      },
    },
  });

  const conversationIds = cards.map(card => card.conversationId).filter((id): id is string => Boolean(id));
  const actionCounts = action
    ? await prisma.internalActionLog.groupBy({
        by: ["conversationId"],
        where: {
          action,
          conversationId: { in: conversationIds },
        },
        _count: { conversationId: true },
      })
    : [];

  const actionCountMap = new Map(actionCounts.map(item => [item.conversationId, item._count.conversationId]));

  const preview = cards
    .map(card => ({
      pipelineCardId: card.id,
      stage: card.stage,
      source: card.source,
      contactId: card.contactId,
      contactName: card.contact.name,
      contactPhone: card.contact.phone,
      contactEmail: card.contact.email,
      conversationId: card.conversationId,
      historyMatchCount: card.conversationId ? actionCountMap.get(card.conversationId) ?? 0 : 0,
    }))
    .filter(item => (action ? item.historyMatchCount > 0 : true));

  return NextResponse.json({
    ok: true,
    filters: { stage: stage ?? null, source: source ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null, action: action ?? null },
    count: preview.length,
    preview,
  });
}
