import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import {
  getFollowUpCadenceSettings,
  normalizeFollowUpCadenceHours,
} from "@/lib/crm/followUpCadence";

export async function GET() {
  const authorization = await requireAdminAuth();
  if (authorization instanceof NextResponse) return authorization;
  return NextResponse.json({ ok: true, settings: await getFollowUpCadenceSettings() });
}

export async function PUT(request: Request) {
  const authorization = await requireAdminAuth();
  if (authorization instanceof NextResponse) return authorization;

  const body = await request.json().catch(() => null);
  const cadenceHours = normalizeFollowUpCadenceHours(body?.cadenceHours);
  if (!body || typeof body.enabled !== "boolean" || !cadenceHours) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const settings = await prisma.followUpSettings.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      enabled: body.enabled,
      cadenceHoursJson: JSON.stringify(cadenceHours),
    },
    update: {
      enabled: body.enabled,
      cadenceHoursJson: JSON.stringify(cadenceHours),
    },
  });
  await prisma.internalActionLog.create({
    data: {
      action: "FollowUpCadenceUpdated",
      userId: authorization.adminId,
      metadataJson: JSON.stringify({
        actorType: "human",
        origin: "admin_ui",
        enabled: settings.enabled,
        cadenceHours,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    settings: { enabled: settings.enabled, cadenceHours },
  });
}
