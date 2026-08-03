import { afterEach, describe, expect, it, vi } from "vitest";

describe("Evolution instance operations", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("configures webhook events with the dedicated secret header", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "http://evolution.test/");
    vi.stubEnv("EVOLUTION_API_KEY", "synthetic-key");
    vi.stubEnv("EVOLUTION_INSTANCE_NAME", "delplata-test");
    vi.stubEnv("EVOLUTION_WEBHOOK_SECRET", "synthetic-webhook-secret");
    vi.stubEnv("CRM_WEBHOOK_URL", "https://crm.test/api/whatsapp/webhook");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ enabled: true }), { status: 200 }));
    const { setupWebhook } = await import("./evolution-client.mjs");

    await setupWebhook();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://evolution.test/webhook/set/delplata-test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: "https://crm.test/api/whatsapp/webhook",
            byEvents: true,
            base64: false,
            headers: { "x-evolution-secret": "synthetic-webhook-secret" },
            events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE", "SEND_MESSAGE"],
          },
        }),
      }),
    );
  });

  it("queries connection state without returning provider payload details", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "http://evolution.test");
    vi.stubEnv("EVOLUTION_API_KEY", "synthetic-key");
    vi.stubEnv("EVOLUTION_INSTANCE_NAME", "delplata-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ instance: { state: "open", owner: "hidden" } }), { status: 200 }));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { connectionState } = await import("./evolution-client.mjs");
    await expect(connectionState()).resolves.toBe("open");
    expect(log).toHaveBeenCalledWith("Estado da instancia delplata-test: open");
    expect(JSON.stringify(log.mock.calls)).not.toContain("hidden");
  });

  it("sanitizes API error bodies", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "http://evolution.test");
    vi.stubEnv("EVOLUTION_API_KEY", "synthetic-key");
    vi.stubEnv("EVOLUTION_INSTANCE_NAME", "delplata-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ secret: "provider-detail" }), { status: 401 }));
    const { connectionState } = await import("./evolution-client.mjs");
    await expect(connectionState()).rejects.toThrow("Evolution API request failed with status 401");
  });
});
