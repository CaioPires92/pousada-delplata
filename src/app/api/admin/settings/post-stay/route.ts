import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { getPostStaySettings, normalizeOfficialReviewUrl } from "@/lib/crm/postStaySettings";

export async function GET() {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, settings: await getPostStaySettings() });
}

export async function PUT(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const officialReviewUrl = normalizeOfficialReviewUrl(body?.officialReviewUrl);
  if (!body || officialReviewUrl === undefined) {
    return NextResponse.json({ ok: false, error: "invalid_review_url" }, { status: 400 });
  }

  const settings = await prisma.postStaySettings.upsert({
    where: { id: "global" },
    create: { id: "global", officialReviewUrl },
    update: { officialReviewUrl },
  });
  await prisma.internalActionLog.create({
    data: {
      action: "PostStaySettingsUpdated",
      userId: auth.adminId,
      metadataJson: JSON.stringify({
        actorType: "human",
        origin: "admin_ui",
        reviewConfigured: Boolean(settings.officialReviewUrl),
      }),
    },
  });
  return NextResponse.json({
    ok: true,
    settings: {
      officialReviewUrl: settings.officialReviewUrl,
      reviewConfigured: Boolean(settings.officialReviewUrl),
    },
  });
}
