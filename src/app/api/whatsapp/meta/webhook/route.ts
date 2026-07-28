import { NextResponse } from "next/server";
import { verifyMetaWebhookChallenge } from "@/lib/messaging/meta-webhook-verification";
import { verifyMetaWebhookSignature } from "@/lib/messaging/meta-webhook-signature";
import { normalizeMetaWebhook } from "@/lib/messaging/meta-webhook-normalizer";
import { persistNormalizedWebhookEvents } from "@/lib/messaging/webhook-event-store";

export async function GET(request: Request) {
  const result = verifyMetaWebhookChallenge(
    new URL(request.url).searchParams,
    process.env.META_WHATSAPP_VERIFY_TOKEN,
  );

  if (result.ok) {
    return new NextResponse(result.challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (result.reason === "not_configured") {
    return NextResponse.json(
      { ok: false, error: "meta_webhook_not_configured" },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { ok: false, error: "invalid_meta_webhook_verification" },
    { status: 403 },
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = verifyMetaWebhookSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    process.env.META_WHATSAPP_APP_SECRET,
  );

  if (!signature.ok) {
    if (signature.reason === "not_configured") {
      return NextResponse.json(
        { ok: false, error: "meta_webhook_signature_not_configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "invalid_meta_webhook_signature" },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_meta_webhook_payload" },
      { status: 400 },
    );
  }

  const events = normalizeMetaWebhook(payload);
  const persisted = await persistNormalizedWebhookEvents("meta", events);
  return NextResponse.json({ ok: true, ...persisted });
}
