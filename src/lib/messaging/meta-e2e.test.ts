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

  it("rejects invalid polling configuration before sending", async () => {
    const send = vi.fn();

    await expect(runMetaMessagingE2E({
      META_E2E_ENABLED: "true",
      META_WHATSAPP_TEST_RECIPIENT: "15550000001",
      META_E2E_WEBHOOK_TIMEOUT_MS: "not-a-number",
    }, () => ({
      name: "meta",
      normalizeWebhook: vi.fn(),
      send,
    }))).rejects.toThrow("META_E2E_WEBHOOK_TIMEOUT_MS must be a positive integer");

    expect(send).not.toHaveBeenCalled();
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
    const findFirst = vi.fn().mockResolvedValue({
      normalizedEventJson: JSON.stringify({
        kind: "status",
        status: "delivered",
        externalMessageId: "wamid.TEST_E2E_001",
      }),
      receivedAt: new Date("2026-07-28T17:30:02.000Z"),
    });

    await expect(runMetaMessagingE2E({
      META_E2E_ENABLED: "true",
      META_WHATSAPP_TEST_RECIPIENT: "15550000001",
      META_WHATSAPP_ACCESS_TOKEN: "secret-token",
      META_WHATSAPP_PHONE_NUMBER_ID: "phone-id",
      META_WHATSAPP_GRAPH_API_VERSION: "v99.0",
    }, () => provider, () => new Date("2026-07-28T17:30:00.000Z"), {
      messagingWebhookEvent: { findFirst },
    })).resolves.toEqual({
      ok: true,
      provider: "meta",
      externalMessageId: "wamid.TEST_E2E_001",
      acceptedAt: "2026-07-28T17:30:00.000Z",
      status: "accepted",
      delivery: {
        status: "delivered",
        receivedAt: "2026-07-28T17:30:02.000Z",
      },
    });

    expect(send).toHaveBeenCalledWith({
      kind: "text",
      recipientId: "15550000001",
      text: "[Delplata CRM E2E] 2026-07-28T17:30:00.000Z",
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        provider: "meta",
        externalMessageId: "wamid.TEST_E2E_001",
        eventKind: "status",
      },
      orderBy: { receivedAt: "desc" },
      select: {
        normalizedEventJson: true,
        receivedAt: true,
      },
    });
  });
});
