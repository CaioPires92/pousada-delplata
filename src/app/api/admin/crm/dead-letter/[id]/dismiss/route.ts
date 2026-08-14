import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import { dismissDeadLetterItem } from "@/lib/crm/automationQueue";
import prisma from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!id || !reason) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  const result = await dismissDeadLetterItem({ deadLetterId: id, reason });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === "dead_letter_not_found" ? 404 : 409 });
  }
  await prisma.internalActionLog.create({
    data: {
      action: "DeadLetterDismissed",
      userId: auth.adminId,
      metadataJson: JSON.stringify({ deadLetterId: id, reason, changed: result.dismissed, origin: "admin_ui" }),
    },
  });
  return NextResponse.json(result);
}
