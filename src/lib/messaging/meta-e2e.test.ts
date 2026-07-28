import { describe, expect, it, vi } from "vitest";
import type { MessagingProvider } from "./provider";
import { runMetaMessagingE2E } from "./meta-e2e";

describe("Meta messaging E2E runner", () => {
  it("fails closed without the explicit opt-in flag", async () => {
    const send = vi.fn();

    await expect(runMetaMessagingE2E({}, () => ({
      name: "meta",
      normalizeWebhook: vi.fn(),
      send,
    }))).rejects.toThrow("META_E2E_ENABLED=true");

    expect(send).not.toHaveBeenCalled();
  });

  it("requires an explicit test recipient before constructing the provider", async () => {
    const providerFactory = vi.fn();

    await expect(runMetaMessagingE2E({
      META_E2E_ENABLED: "true",
    }, providerFactory)).rejects.toThrow("META_WHATSAPP_TEST_RECIPIENT");

    expect(providerFactory).not.toHaveBeenCalled();
  });

  it("sends a synthetic message and returns only sanitized evidence", async () => {
    const send = vi.fn().mockResolvedValue({
      externalMessageId: "wamid.TEST_E2E_001",
      acceptedAt: "2026-07-28T17:30:00.000Z",
      status: "accepted",
    });
    const provider: MessagingProvider = {
      name: "meta",
      normalizeWebhook: vi.fn(),
      send,
    };

    await expect(runMetaMessagingE2E({
      META_E2E_ENABLED: "true",
      META_WHATSAPP_TEST_RECIPIENT: "15550000001",
      META_WHATSAPP_ACCESS_TOKEN: "secret-token",
      META_WHATSAPP_PHONE_NUMBER_ID: "phone-id",
      META_WHATSAPP_GRAPH_API_VERSION: "v99.0",
    }, () => provider, () => new Date("2026-07-28T17:30:00.000Z"))).resolves.toEqual({
      ok: true,
      provider: "meta",
      externalMessageId: "wamid.TEST_E2E_001",
      acceptedAt: "2026-07-28T17:30:00.000Z",
      status: "accepted",
    });

    expect(send).toHaveBeenCalledWith({
      kind: "text",
      recipientId: "15550000001",
      text: "[Delplata CRM E2E] 2026-07-28T17:30:00.000Z",
    });
  });
});
