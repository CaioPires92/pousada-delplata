import { NextResponse } from "next/server";
import { verifyMetaWebhookChallenge } from "@/lib/messaging/meta-webhook-verification";

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
