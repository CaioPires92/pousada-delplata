import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const suggestions = await prisma.supervisedReplySuggestion.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      conversationId: true,
      content: true,
      intent: true,
      createdAt: true,
      conversation: { select: { contact: { select: { name: true, phone: true } } } },
    },
  });

  return NextResponse.json({
    ok: true,
    suggestions: suggestions.map(suggestion => ({
      id: suggestion.id,
      conversationId: suggestion.conversationId,
      content: suggestion.content,
      intent: suggestion.intent,
      createdAt: suggestion.createdAt,
      contactLabel: suggestion.conversation.contact.name || suggestion.conversation.contact.phone || "Contato",
    })),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null);
  const suggestionId = typeof body?.suggestionId === "string" ? body.suggestionId.trim() : "";
  if (!suggestionId) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const result = await prisma.supervisedReplySuggestion.updateMany({
    where: { id: suggestionId, status: "pending" },
    data: { status: "dismissed", reviewedBy: auth.adminId, reviewedAt: new Date() },
  });
  if (result.count === 0) {
    return NextResponse.json({ ok: false, error: "suggestion_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
