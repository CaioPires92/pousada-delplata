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
  const quietHoursStart = body?.quietHoursStart ?? 20;
  const quietHoursEnd = body?.quietHoursEnd ?? 8;
  const validQuietHours = Number.isInteger(quietHoursStart)
    && quietHoursStart >= 0
    && quietHoursStart <= 23
    && Number.isInteger(quietHoursEnd)
    && quietHoursEnd >= 0
    && quietHoursEnd <= 23
    && quietHoursStart !== quietHoursEnd;
  if (!body || typeof body.enabled !== "boolean" || !cadenceHours || !validQuietHours) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const settings = await prisma.followUpSettings.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      enabled: body.enabled,
      cadenceHoursJson: JSON.stringify(cadenceHours),
      quietHoursStart,
      quietHoursEnd,
    },
    update: {
      enabled: body.enabled,
      cadenceHoursJson: JSON.stringify(cadenceHours),
      quietHoursStart,
      quietHoursEnd,
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
        quietHoursStart,
        quietHoursEnd,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    settings: { enabled: settings.enabled, cadenceHours, quietHoursStart, quietHoursEnd },
  });
}
