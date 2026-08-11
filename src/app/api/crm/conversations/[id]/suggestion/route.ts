import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const suggestion = await prisma.supervisedReplySuggestion.findFirst({
    where: { conversationId: id, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      intent: true,
      ruleVersion: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, suggestion });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { suggestionId?: unknown; action?: unknown } | null;
  if (body?.action !== "dismiss" || typeof body.suggestionId !== "string") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const result = await prisma.supervisedReplySuggestion.updateMany({
    where: {
      id: body.suggestionId,
      conversationId: id,
      status: "pending",
    },
    data: {
      status: "dismissed",
      reviewedBy: auth.adminId,
      reviewedAt: new Date(),
    },
  });
  if (result.count === 0) {
    return NextResponse.json({ ok: false, error: "suggestion_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
