import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const statusParam = new URL(request.url).searchParams.get("status") ?? "open";
  const allowedStatuses = new Set(["open", "replayed", "dismissed", "all"]);
  if (!allowedStatuses.has(statusParam)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  const items = await prisma.deadLetterQueueItem.findMany({
    where: statusParam === "all" ? undefined : { status: statusParam },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      conversationId: true,
      source: true,
      action: true,
      reason: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      replayedAt: true,
    },
  });

  return NextResponse.json({ ok: true, status: statusParam, items });
}
