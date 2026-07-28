import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route";

function verificationRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/whatsapp/meta/webhook");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url);
}

function signatureFor(body: string, secret = "synthetic-app-secret") {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function webhookRequest(body: string, signature?: string) {
  return new Request("http://localhost/api/whatsapp/meta/webhook", {
    method: "POST",
    headers: signature ? { "x-hub-signature-256": signature } : undefined,
    body,
  });
}

describe("Meta webhook verification", () => {
  beforeEach(() => {
    process.env.META_WHATSAPP_VERIFY_TOKEN = "synthetic-verification-token";
    process.env.META_WHATSAPP_APP_SECRET = "synthetic-app-secret";
  });

  afterEach(() => {
    delete process.env.META_WHATSAPP_VERIFY_TOKEN;
    delete process.env.META_WHATSAPP_APP_SECRET;
  });

  it("returns the exact challenge for a valid subscription request", async () => {
    const response = await GET(verificationRequest({
      "hub.mode": "subscribe",
      "hub.verify_token": "synthetic-verification-token",
      "hub.challenge": "1234567890",
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("1234567890");
  });

  it.each([
    ["wrong token", {
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "1234567890",
    }],
    ["wrong mode", {
      "hub.mode": "unsubscribe",
      "hub.verify_token": "synthetic-verification-token",
      "hub.challenge": "1234567890",
    }],
    ["missing challenge", {
      "hub.mode": "subscribe",
      "hub.verify_token": "synthetic-verification-token",
    }],
  ])("rejects %s without returning the challenge", async (_name, params) => {
    const response = await GET(verificationRequest(params));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: "invalid_meta_webhook_verification",
    });
  });

  it("fails closed when the verification token is not configured", async () => {
    delete process.env.META_WHATSAPP_VERIFY_TOKEN;

    const response = await GET(verificationRequest({
      "hub.mode": "subscribe",
      "hub.verify_token": "synthetic-verification-token",
      "hub.challenge": "1234567890",
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "meta_webhook_not_configured",
    });
  });

  it("accepts a webhook only when the signature matches the exact raw body", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const response = await POST(webhookRequest(body, signatureFor(body)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, acceptedEvents: 0 });
  });

  it.each([
    ["missing signature", undefined],
    ["malformed signature", "sha256=not-hex"],
    ["signature from another body", signatureFor('{"different":true}')],
    ["signature from another secret", signatureFor('{"ok":true}', "wrong-secret")],
  ])("rejects %s", async (_name, signature) => {
    const response = await POST(webhookRequest('{"ok":true}', signature));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "invalid_meta_webhook_signature",
    });
  });

  it("validates the signature before attempting to parse the body", async () => {
    const response = await POST(webhookRequest("{invalid-json", "sha256=not-hex"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "invalid_meta_webhook_signature",
    });
  });

  it("rejects malformed JSON only after a valid signature", async () => {
    const body = "{invalid-json";
    const response = await POST(webhookRequest(body, signatureFor(body)));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "invalid_meta_webhook_payload",
    });
  });

  it("fails closed when the Meta app secret is not configured", async () => {
    delete process.env.META_WHATSAPP_APP_SECRET;
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const response = await POST(webhookRequest(body, signatureFor(body)));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "meta_webhook_signature_not_configured",
    });
  });
});
