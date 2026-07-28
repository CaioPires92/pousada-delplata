import { createHmac, timingSafeEqual } from "node:crypto";

export type MetaWebhookSignatureResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "missing_signature" | "invalid_signature" };

const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/i;

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined,
): MetaWebhookSignatureResult {
  if (!appSecret) {
    return { ok: false, reason: "not_configured" };
  }

  if (!signatureHeader) {
    return { ok: false, reason: "missing_signature" };
  }

  const match = SIGNATURE_PATTERN.exec(signatureHeader);
  if (!match) {
    return { ok: false, reason: "invalid_signature" };
  }

  const received = Buffer.from(match[1], "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true };
}
