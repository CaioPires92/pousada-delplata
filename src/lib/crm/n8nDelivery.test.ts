import { afterEach, describe, expect, it, vi } from "vitest";

import type { N8nEventEnvelope } from "./n8nEventContract";
import { deliverN8nEvent, getN8nDeliveryConfig, type N8nDeliveryConfig } from "./n8nDelivery";

const envelope: N8nEventEnvelope = {
  schemaVersion: 1,
  eventId: "event-1",
  eventType: "LeadCreated",
  occurredAt: "2026-08-05T18:30:00.000Z",
  entityId: "conversation-1",
  correlationId: "conversation-1",
  causationId: "event-1",
  resources: { contactId: "contact-1", conversationId: "conversation-1" },
  data: { source: "whatsapp" },
};

const config: N8nDeliveryConfig = {
  url: "https://n8n.example/webhook/crm",
  token: "webhook-secret",
  timeoutMs: 1_000,
  maxAttempts: 3,
};

describe("n8n event delivery", () => {
  afterEach(() => {
    delete process.env.N8N_ENABLED;
    delete process.env.N8N_WEBHOOK_URL;
    delete process.env.N8N_WEBHOOK_TOKEN;
  });

  it("stays disabled unless explicitly enabled", () => {
    expect(getN8nDeliveryConfig()).toBeNull();
  });

  it("requires a dedicated webhook token when enabled", () => {
    process.env.N8N_ENABLED = "true";
    process.env.N8N_WEBHOOK_URL = config.url;
    expect(() => getN8nDeliveryConfig()).toThrow("n8n_configuration_incomplete");
  });

  it("sends an authenticated idempotent envelope", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await expect(deliverN8nEvent(envelope, { config, fetchImpl })).resolves.toMatchObject({
      delivered: true,
      attempts: 1,
    });
    expect(fetchImpl).toHaveBeenCalledWith(config.url, expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer webhook-secret",
        "X-CRM-Event-ID": "event-1",
      }),
      body: JSON.stringify(envelope),
    }));
  });

  it("retries transient failures with bounded backoff", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(deliverN8nEvent(envelope, { config, fetchImpl, sleep })).resolves.toMatchObject({
      delivered: true,
      attempts: 2,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it("does not retry permanent authentication failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(deliverN8nEvent(envelope, { config, fetchImpl, sleep }))
      .rejects.toThrow("n8n_delivery_rejected_401");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("rejects a malformed envelope before making a request", async () => {
    const fetchImpl = vi.fn();

    await expect(deliverN8nEvent({ ...envelope, data: { token: "secret" } }, { config, fetchImpl }))
      .rejects.toThrow("invalid_n8n_event_payload");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
