import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import { replayDeadLetterItem } from "@/lib/crm/automationQueue";
import prisma from "@/lib/prisma";

const REQUIRED_CONFIRMATION = "REPROCESSAR";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (!id || body?.confirmation !== REQUIRED_CONFIRMATION) {
    return NextResponse.json({ ok: false, error: "confirmation_required" }, { status: 400 });
  }

  const result = await replayDeadLetterItem({ deadLetterId: id });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.error === "dead_letter_not_found" ? 404 : 409 },
    );
  }

  await prisma.internalActionLog.create({
    data: {
      action: "DeadLetterReplayQueued",
      userId: auth.adminId,
      metadataJson: JSON.stringify({ deadLetterId: id, jobId: result.jobId, origin: "admin_ui" }),
    },
  });

  return NextResponse.json(result);
}
