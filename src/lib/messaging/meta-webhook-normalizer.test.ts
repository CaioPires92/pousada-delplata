import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isNormalizedMessagingEvent } from "./provider";
import { normalizeMetaWebhook } from "./meta-webhook-normalizer";

const fixturesDirectory = path.join(import.meta.dirname, "fixtures", "meta");

async function fixture(filename: string) {
  return JSON.parse(await readFile(path.join(fixturesDirectory, filename), "utf8"));
}

describe("normalizeMetaWebhook", () => {
  it.each([
    ["text-message.json", { kind: "text", text: "Mensagem sintética para teste" }],
    ["button-message.json", { kind: "button", id: "confirm_test", title: "Confirmar teste" }],
    ["list-message.json", {
      kind: "list",
      id: "room_test_001",
      title: "Quarto teste",
      description: "Opção sintética",
    }],
    ["image-message.json", {
      kind: "image",
      mediaId: "MEDIA_TEST_IMAGE_001",
      mimeType: "image/jpeg",
      caption: "Imagem sintética",
    }],
    ["document-message.json", {
      kind: "document",
      mediaId: "MEDIA_TEST_DOCUMENT_001",
      filename: "arquivo-teste.pdf",
      mimeType: "application/pdf",
      caption: "Documento sintético",
    }],
    ["unknown-message.json", { kind: "unknown", rawType: "sticker" }],
  ])("normalizes %s", async (filename, expectedContent) => {
    const events = normalizeMetaWebhook(await fixture(filename));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "message",
      channel: "whatsapp",
      senderId: "15550000001",
      recipientId: "PHONE_NUMBER_TEST_001",
      content: expectedContent,
    });
    expect(isNormalizedMessagingEvent(events[0])).toBe(true);
  });

  it("normalizes every supported delivery status and failure detail", async () => {
    const events = normalizeMetaWebhook(await fixture("status-events.json"));

    expect(events).toHaveLength(4);
    expect(events.map(event => event.kind === "status" ? event.status : null)).toEqual([
      "sent",
      "delivered",
      "read",
      "failed",
    ]);
    expect(events[3]).toMatchObject({
      kind: "status",
      externalMessageId: "wamid.TEST_OUTBOUND_002",
      error: {
        code: "131000",
        title: "Synthetic test failure",
        detail: "No production detail",
      },
    });
    expect(events.every(isNormalizedMessagingEvent)).toBe(true);
  });

  it.each([
    null,
    {},
    { object: "other", entry: [] },
    { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {} }] }] },
  ])("ignores malformed or unrelated payload %# without throwing", payload => {
    expect(normalizeMetaWebhook(payload)).toEqual([]);
  });
});
