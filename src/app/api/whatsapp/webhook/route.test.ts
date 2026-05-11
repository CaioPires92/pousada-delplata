import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { POST } from "./[[...slug]]/route";

const TEST_INSTANCE = "test-instance";

function webhookRequest(payload: unknown) {
  return new Request("http://localhost/api/whatsapp/webhook/messages-upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function routeParams() {
  return { params: Promise.resolve({ slug: ["messages-upsert"] }) };
}

function textPayload(id: string, remoteJid: string, text = "Mensagem de teste") {
  return {
    event: "messages.upsert",
    instance: TEST_INSTANCE,
    data: {
      key: {
        remoteJid,
        fromMe: false,
        id,
      },
      pushName: "Contato Teste",
      message: {
        conversation: text,
      },
      messageType: "conversation",
      messageTimestamp: 1_779_000_000,
    },
  };
}

function imagePayload(id: string, remoteJid: string) {
  return {
    event: "messages.upsert",
    instance: TEST_INSTANCE,
    data: {
      key: {
        remoteJid,
        fromMe: false,
        id,
      },
      pushName: "Contato Midia",
      message: {
        imageMessage: {
          caption: "Foto da pousada",
          url: "https://example.com/image.jpg",
        },
      },
      messageType: "imageMessage",
      messageTimestamp: 1_779_000_001,
    },
  };
}

function emptyMessagePayload(id: string, remoteJid: string) {
  return {
    event: "messages.upsert",
    instance: TEST_INSTANCE,
    data: {
      key: {
        remoteJid,
        fromMe: false,
        id,
      },
      pushName: "Contato Vazio",
      message: {},
      messageType: "unknown",
      messageTimestamp: 1_779_000_002,
    },
  };
}

async function cleanupTestData() {
  const contacts = await prisma.contact.findMany({
    where: { source: "whatsapp", name: { startsWith: "Contato" } },
    select: { id: true },
  });
  const contactIds = contacts.map(contact => contact.id);

  if (contactIds.length === 0) return;

  await prisma.internalActionLog.deleteMany({ where: { contactId: { in: contactIds } } });
  await prisma.pipelineCard.deleteMany({ where: { contactId: { in: contactIds } } });
  await prisma.conversation.deleteMany({ where: { contactId: { in: contactIds } } });
  await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
}

describe("WhatsApp CRM webhook hardening", () => {
  beforeEach(async () => {
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    process.env.EVOLUTION_API_URL = "http://evolution.test";
    process.env.EVOLUTION_API_KEY = "test-key";
    process.env.EVOLUTION_INSTANCE_NAME = TEST_INSTANCE;
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => null,
    } as Response);
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("saves a phone contact message and treats duplicate delivery as idempotent", async () => {
    const payload = textPayload("test-phone-duplicate", "5511999990001@s.whatsapp.net");

    const firstResponse = await POST(webhookRequest(payload), routeParams());
    const firstBody = await firstResponse.json();
    const secondResponse = await POST(webhookRequest(payload), routeParams());
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody.ok).toBe(true);
    expect(secondBody.duplicated).toBe(true);

    const messages = await prisma.message.findMany({
      where: { externalMessageId: "test-phone-duplicate" },
      include: { conversation: { include: { contact: true } } },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].conversation.contact.phone).toBe("5511999990001");
  });

  it("handles two simultaneous deliveries for the same external message id", async () => {
    const payload = textPayload("test-concurrent-duplicate", "5511999990002@s.whatsapp.net", "Mensagem simultanea");

    const responses = await Promise.all([
      POST(webhookRequest(payload), routeParams()),
      POST(webhookRequest(payload), routeParams()),
    ]);
    const bodies = await Promise.all(responses.map(response => response.json()));

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(bodies.some(body => body.duplicated === true)).toBe(true);

    const messages = await prisma.message.findMany({
      where: { externalMessageId: "test-concurrent-duplicate" },
    });
    expect(messages).toHaveLength(1);
  });

  it("saves a LID contact without a phone number", async () => {
    const payload = textPayload("test-lid-message", "123456789012345@lid", "Mensagem via LID");

    const response = await POST(webhookRequest(payload), routeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const contact = await prisma.contact.findFirst({
      where: { lid: "123456789012345" },
    });

    expect(contact?.whatsappJid).toBe("123456789012345@lid");
    expect(contact?.phone).toBeNull();
  });

  it("saves messages without text content", async () => {
    const payload = emptyMessagePayload("test-empty-message", "5511999990003@s.whatsapp.net");

    const response = await POST(webhookRequest(payload), routeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const message = await prisma.message.findFirst({
      where: { externalMessageId: "test-empty-message" },
    });

    expect(message?.content).toBeNull();
    expect(message?.messageType).toBe("unknown");
  });

  it("saves media messages with caption and media url", async () => {
    const payload = imagePayload("test-media-message", "5511999990004@s.whatsapp.net");

    const response = await POST(webhookRequest(payload), routeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const message = await prisma.message.findFirst({
      where: { externalMessageId: "test-media-message" },
    });

    expect(message?.messageType).toBe("image");
    expect(message?.content).toBe("Foto da pousada");
    expect(message?.mediaUrl).toBe("https://example.com/image.jpg");
  });
});
