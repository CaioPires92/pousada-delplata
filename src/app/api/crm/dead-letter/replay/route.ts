import { NextResponse } from "next/server";

import { replayDeadLetterItem } from "@/lib/crm/automationQueue";

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export async function POST(request: Request) {
  const expectedToken = process.env.CRM_INTERNAL_API_TOKEN;
  const token = getBearerToken(request);

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const deadLetterId = asNonEmptyString((body as any)?.deadLetterId);

    if (!deadLetterId) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const result = await replayDeadLetterItem({ deadLetterId });

    if (!result.ok) {
      const status = result.error === "dead_letter_not_found" ? 404 : 400;
      return NextResponse.json({ ok: false, error: result.error }, { status });
    }

    return NextResponse.json({ ok: true, jobId: result.jobId });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
