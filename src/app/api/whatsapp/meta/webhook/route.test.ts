import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

function verificationRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/whatsapp/meta/webhook");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url);
}

describe("Meta webhook verification", () => {
  beforeEach(() => {
    process.env.META_WHATSAPP_VERIFY_TOKEN = "synthetic-verification-token";
  });

  afterEach(() => {
    delete process.env.META_WHATSAPP_VERIFY_TOKEN;
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
});
