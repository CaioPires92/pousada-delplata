import { describe, expect, it, vi } from "vitest";
import type { NormalizedMessagingEvent } from "./provider";
import { persistNormalizedWebhookEvents } from "./webhook-event-store";

const messageEvent: NormalizedMessagingEvent = {
  kind: "message",
  externalEventId: "message:wamid.TEST_001",
  externalMessageId: "wamid.TEST_001",
  channel: "whatsapp",
  senderId: "15550000001",
  recipientId: "PHONE_NUMBER_TEST_001",
  occurredAt: "2026-07-28T12:00:00.000Z",
  content: { kind: "text", text: "Mensagem sintética" },
};

describe("persistNormalizedWebhookEvents", () => {
  it("stores only normalized data and reports accepted events", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-1" });

    await expect(persistNormalizedWebhookEvents("meta", [messageEvent], {
      messagingWebhookEvent: { create },
    })).resolves.toEqual({ acceptedEvents: 1, duplicateEvents: 0 });

    expect(create).toHaveBeenCalledWith({
      data: {
        provider: "meta",
        externalEventId: "message:wamid.TEST_001",
        eventKind: "message",
        externalMessageId: "wamid.TEST_001",
        normalizedEventJson: JSON.stringify(messageEvent),
      },
    });
  });

  it("treats a unique constraint collision as a duplicate", async () => {
    const create = vi.fn().mockRejectedValue({ code: "P2002" });

    await expect(persistNormalizedWebhookEvents("meta", [messageEvent], {
      messagingWebhookEvent: { create },
    })).resolves.toEqual({ acceptedEvents: 0, duplicateEvents: 1 });
  });

  it("redacts credentials before storing a status failure", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-status" });
    const statusEvent: NormalizedMessagingEvent = {
      kind: "status",
      externalEventId: "status:wamid.TEST_FAILED:failed:1785254411",
      externalMessageId: "wamid.TEST_FAILED",
      channel: "whatsapp",
      status: "failed",
      occurredAt: "2026-07-28T12:00:11.000Z",
      error: {
        detail: "Bearer secret-token access_token=private-value",
      },
    };

    await persistNormalizedWebhookEvents("meta", [statusEvent], {
      messagingWebhookEvent: { create },
    });

    const stored = create.mock.calls[0]?.[0].data.normalizedEventJson;
    expect(stored).toContain("Bearer [REDACTED]");
    expect(stored).toContain("access_token=[REDACTED]");
    expect(stored).not.toContain("secret-token");
    expect(stored).not.toContain("private-value");
  });

  it("does not hide database errors unrelated to deduplication", async () => {
    const create = vi.fn().mockRejectedValue(new Error("database unavailable"));

    await expect(persistNormalizedWebhookEvents("meta", [messageEvent], {
      messagingWebhookEvent: { create },
    })).rejects.toThrow("database unavailable");
  });
});
