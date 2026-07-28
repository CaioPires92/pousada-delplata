import { timingSafeEqual } from "node:crypto";

export type MetaWebhookVerificationResult =
  | { ok: true; challenge: string }
  | { ok: false; reason: "not_configured" | "invalid_request" };

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyMetaWebhookChallenge(
  searchParams: URLSearchParams,
  expectedToken: string | undefined,
): MetaWebhookVerificationResult {
  if (!expectedToken) {
    return { ok: false, reason: "not_configured" };
  }

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode !== "subscribe"
    || !token
    || !challenge
    || !secureEqual(token, expectedToken)
  ) {
    return { ok: false, reason: "invalid_request" };
  }

  return { ok: true, challenge };
}
