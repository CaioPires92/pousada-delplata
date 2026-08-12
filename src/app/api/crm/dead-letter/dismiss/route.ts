import { NextResponse } from "next/server";

import { dismissDeadLetterItem } from "@/lib/crm/automationQueue";
import prisma from "@/lib/prisma";

function bearer(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

export async function POST(request: Request) {
  if (!process.env.CRM_INTERNAL_API_TOKEN || bearer(request) !== process.env.CRM_INTERNAL_API_TOKEN) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { deadLetterId?: unknown; reason?: unknown } | null;
  const deadLetterId = typeof body?.deadLetterId === "string" ? body.deadLetterId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!deadLetterId || !reason) {
    return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const result = await dismissDeadLetterItem({ deadLetterId, reason });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === "dead_letter_not_found" ? 404 : 409 });
  }
  await prisma.internalActionLog.create({
    data: {
      action: "DeadLetterDismissed",
      metadataJson: JSON.stringify({ deadLetterId, reason, changed: result.dismissed, origin: "internal_api" }),
    },
  });
  return NextResponse.json(result);
}
