import { describe, expect, it } from "vitest";
import {
  isNormalizedMessagingEvent,
  type MessagingProvider,
  type NormalizedMessagingEvent,
} from "./provider";

describe("MessagingProvider normalized contract", () => {
  it.each([
    { kind: "text", text: "Olá" },
    { kind: "button", id: "confirm", title: "Confirmar" },
    { kind: "list", id: "room-1", title: "Quarto 1" },
    { kind: "image", mediaId: "media-image" },
    { kind: "document", mediaId: "media-document", filename: "reserva.pdf" },
    { kind: "unknown", rawType: "sticker" },
  ])("accepts normalized inbound $kind content", content => {
    expect(isNormalizedMessagingEvent({
      kind: "message",
      externalEventId: `event-${content.kind}`,
      externalMessageId: `message-${content.kind}`,
      channel: "whatsapp",
      senderId: "5511999999999",
      recipientId: "5511888888888",
      occurredAt: "2026-07-28T12:00:00.000Z",
      content,
    })).toBe(true);
  });

  it.each(["sent", "delivered", "read", "failed"])("accepts normalized %s status", status => {
    expect(isNormalizedMessagingEvent({
      kind: "status",
      externalEventId: `status-${status}`,
      externalMessageId: "wamid.123",
      channel: "whatsapp",
      status,
      occurredAt: "2026-07-28T12:00:00.000Z",
    })).toBe(true);
  });

  it.each([
    ["missing external event ID", {
      kind: "status",
      externalMessageId: "wamid.123",
      channel: "whatsapp",
      status: "sent",
      occurredAt: "2026-07-28T12:00:00.000Z",
    }],
    ["unknown status", {
      kind: "status",
      externalEventId: "event-1",
      externalMessageId: "wamid.123",
      channel: "whatsapp",
      status: "queued",
      occurredAt: "2026-07-28T12:00:00.000Z",
    }],
    ["invalid timestamp", {
      kind: "message",
      externalEventId: "event-1",
      externalMessageId: "wamid.123",
      channel: "whatsapp",
      senderId: "5511999999999",
      recipientId: "5511888888888",
      occurredAt: "not-a-date",
      content: { kind: "text", text: "Olá" },
    }],
  ])("rejects %s", (_name, event) => {
    expect(isNormalizedMessagingEvent(event)).toBe(false);
  });

  it("allows provider implementations without exposing provider payloads to callers", async () => {
    const normalized: NormalizedMessagingEvent = {
      kind: "message",
      externalEventId: "event-1",
      externalMessageId: "message-1",
      channel: "whatsapp",
      senderId: "5511999999999",
      recipientId: "5511888888888",
      occurredAt: "2026-07-28T12:00:00.000Z",
      content: { kind: "text", text: "Olá" },
    };
    const provider: MessagingProvider = {
      name: "fixture",
      normalizeWebhook: async () => [normalized],
      send: async () => ({
        externalMessageId: "message-out-1",
        acceptedAt: "2026-07-28T12:00:01.000Z",
        status: "accepted",
      }),
    };

    expect(await provider.normalizeWebhook({ providerSpecific: true })).toEqual([normalized]);
    await expect(provider.send({
      kind: "text",
      recipientId: "5511999999999",
      text: "Resposta",
    })).resolves.toEqual({
      externalMessageId: "message-out-1",
      acceptedAt: "2026-07-28T12:00:01.000Z",
      status: "accepted",
    });
  });
});
