import { describe, expect, it } from "vitest";
import { isNormalizedMessagingEvent } from "./provider";
import { normalizeEvolutionWebhook } from "./evolution-webhook-normalizer";

describe("normalizeEvolutionWebhook", () => {
  it("normalizes an incoming text message", () => {
    const events = normalizeEvolutionWebhook({
      event: "messages.upsert",
      instance: "delplata-test",
      data: {
        key: { id: "EVO_IN_001", remoteJid: "5511999990001@s.whatsapp.net" },
        messageTimestamp: 1785772800,
        messageType: "conversation",
        message: { conversation: "Olá" },
      },
    });
    expect(events).toEqual([{
      kind: "message",
      externalEventId: "evolution:message:EVO_IN_001",
      externalMessageId: "EVO_IN_001",
      channel: "whatsapp",
      senderId: "5511999990001@s.whatsapp.net",
      recipientId: "delplata-test",
      occurredAt: "2026-08-03T16:00:00.000Z",
      content: { kind: "text", text: "Olá" },
    }]);
    expect(events.every(isNormalizedMessagingEvent)).toBe(true);
  });

  it("uses the phone JID when Evolution addresses an incoming message by LID", () => {
    const events = normalizeEvolutionWebhook({
      event: "messages.upsert",
      instance: "delplata-test",
      data: {
        key: {
          id: "EVO_LID_001",
          remoteJid: "23961740038256@lid",
          remoteJidAlt: "5519998701203@s.whatsapp.net",
          addressingMode: "lid",
        },
        messageTimestamp: 1785772800,
        message: { conversation: "Olá via LID" },
      },
    });

    expect(events[0]).toMatchObject({
      kind: "message",
      senderId: "5519998701203@s.whatsapp.net",
    });
  });

  it.each([
    ["SERVER_ACK", "sent"],
    ["DELIVERY_ACK", "delivered"],
    ["READ", "read"],
    ["ERROR", "failed"],
  ])("normalizes %s delivery status", (providerStatus, normalizedStatus) => {
    const events = normalizeEvolutionWebhook({
      event: "messages.update",
      instance: "delplata-test",
      data: {
        keyId: "EVO_OUT_001",
        status: providerStatus,
        timestamp: "2026-08-03T16:10:00.000Z",
        error: { code: "TEST_FAILURE", message: "Synthetic failure" },
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "status",
      externalMessageId: "EVO_OUT_001",
      status: normalizedStatus,
    });
    expect(isNormalizedMessagingEvent(events[0])).toBe(true);
  });

  it("normalizes image, document, button and list content", () => {
    const payloadFor = (message: Record<string, unknown>, id: string) => ({
      event: "MESSAGES_UPSERT",
      instance: "delplata-test",
      data: {
        key: { id, remoteJid: "5511999990001@s.whatsapp.net" },
        timestamp: 1785772800000,
        message,
      },
    });
    expect(normalizeEvolutionWebhook(payloadFor({ imageMessage: { mediaKey: "MEDIA_1", caption: "Foto" } }, "I"))[0]).toMatchObject({ content: { kind: "image", mediaId: "MEDIA_1" } });
    expect(normalizeEvolutionWebhook(payloadFor({ documentMessage: { directPath: "/synthetic", fileName: "reserva.pdf" } }, "D"))[0]).toMatchObject({ content: { kind: "document", filename: "reserva.pdf" } });
    expect(normalizeEvolutionWebhook(payloadFor({ buttonsResponseMessage: { selectedButtonId: "yes", selectedDisplayText: "Sim" } }, "B"))[0]).toMatchObject({ content: { kind: "button", id: "yes" } });
    expect(normalizeEvolutionWebhook(payloadFor({ listResponseMessage: { title: "Quarto", singleSelectReply: { selectedRowId: "suite" } } }, "L"))[0]).toMatchObject({ content: { kind: "list", id: "suite" } });
  });

  it("ignores malformed and unrelated payloads", () => {
    expect(normalizeEvolutionWebhook(null)).toEqual([]);
    expect(normalizeEvolutionWebhook({ event: "connection.update", data: {} })).toEqual([]);
    expect(normalizeEvolutionWebhook({ event: "messages.upsert", data: { message: {} } })).toEqual([]);
  });
});
