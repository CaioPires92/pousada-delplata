import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";

type RouteParams = { params: Promise<{ id: string }> };

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getBearerToken(request);

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  if (!body || typeof body.optInWhatsapp !== "boolean") {
    return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const origin = typeof body.origin === "string" && body.origin.trim() ? body.origin.trim() : "unknown";

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      optInWhatsapp: body.optInWhatsapp,
      optOutAt: body.optInWhatsapp ? null : new Date(),
    },
    select: {
      id: true,
      optInWhatsapp: true,
      optOutAt: true,
    },
  }).catch(() => null);

  if (!contact) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  await recordCrmEvent({
    action: "ContactConsentUpdated",
    contactId: contact.id,
    metadata: {
      optInWhatsapp: contact.optInWhatsapp,
      optOutAt: contact.optOutAt,
      origin,
    },
  });

  return NextResponse.json({ ok: true, contact });
}
