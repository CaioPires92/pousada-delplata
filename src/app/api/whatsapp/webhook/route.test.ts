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

function textPayload(id: string, remoteJid: string, text = "Mensagem de teste", fromMe = false) {
  return {
    event: "messages.upsert",
    instance: TEST_INSTANCE,
    data: {
      key: {
        remoteJid,
        fromMe,
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
  await prisma.messagingWebhookEvent.deleteMany({
    where: { provider: "evolution", externalMessageId: { startsWith: "test-" } },
  });
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
  // Webhook processing includes DB transaction + CRM event side effects, which can be
  // slightly slower on shared CI/local runners and cause intermittent 5s timeouts.
  vi.setConfig({ testTimeout: 15000 });

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
    expect(messages[0].conversation.awaitingHumanResponse).toBe(true);
    expect(messages[0].conversation.waitingSince).not.toBeNull();
    expect(messages[0].conversation.firstCustomerMessageAt).not.toBeNull();
    expect(messages[0].conversation.lastCustomerMessageAt).not.toBeNull();
    const technicalEvents = await prisma.messagingWebhookEvent.findMany({
      where: { provider: "evolution", externalMessageId: "test-phone-duplicate" },
    });
    expect(technicalEvents).toHaveLength(1);
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

  it("reconciles separate phone and LID contacts when remoteJidAlt becomes available", async () => {
    const phoneContact = await prisma.contact.create({
      data: {
        name: "Contato Telefone Existente",
        phone: "5511999990010",
        phoneRaw: "5511999990010",
        whatsappJid: "5511999990010@s.whatsapp.net",
        source: "whatsapp",
      },
    });
    const phoneConversation = await prisma.conversation.create({
      data: { contactId: phoneContact.id, channel: "whatsapp", status: "open" },
    });
    const lidContact = await prisma.contact.create({
      data: {
        name: "Contato LID Duplicado",
        lid: "123456789012346",
        whatsappJid: "123456789012346@lid",
        source: "whatsapp",
      },
    });
    const lidConversation = await prisma.conversation.create({
      data: { contactId: lidContact.id, channel: "whatsapp", status: "open" },
    });
    const payload = textPayload("test-lid-reconciliation", "123456789012346@lid", "Identidade reconciliada");
    (payload.data.key as typeof payload.data.key & { remoteJidAlt: string }).remoteJidAlt =
      "5511999990010@s.whatsapp.net";

    const response = await POST(webhookRequest(payload), routeParams());

    expect(response.status).toBe(200);
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { phone: "5511999990010" },
          { lid: "123456789012346" },
        ],
      },
    });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      id: phoneContact.id,
      phone: "5511999990010",
      lid: "123456789012346",
      whatsappJid: "5511999990010@s.whatsapp.net",
    });
    const conversations = await prisma.conversation.findMany({
      where: { id: { in: [phoneConversation.id, lidConversation.id] } },
    });
    expect(conversations).toHaveLength(2);
    expect(conversations.every(conversation => conversation.contactId === phoneContact.id)).toBe(true);
    await expect(prisma.contact.findUnique({ where: { id: lidContact.id } })).resolves.toBeNull();
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

  it("saves WhatsApp messages sent directly by the inn as human replies", async () => {
    const payload = textPayload("test-direct-whatsapp-reply", "5511999990005@s.whatsapp.net", "Resposta direta pelo WhatsApp", true);

    const response = await POST(webhookRequest(payload), routeParams());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const message = await prisma.message.findFirst({
      where: { externalMessageId: "test-direct-whatsapp-reply" },
      include: {
        conversation: {
          include: {
            contact: true,
          },
        },
      },
    });

    expect(message?.senderType).toBe("human");
    expect(message?.content).toBe("Resposta direta pelo WhatsApp");
    expect(message?.conversation.contact.phone).toBe("5511999990005");
  });

  it("persists and correlates Evolution delivery status updates", async () => {
    const contact = await prisma.contact.create({
      data: { name: "Contato Status", phone: "5511999990006", source: "whatsapp" },
    });
    const conversation = await prisma.conversation.create({
      data: { contactId: contact.id, channel: "whatsapp", status: "open" },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        externalMessageId: "test-status-message",
        senderType: "bot",
        content: "Mensagem",
        messageType: "text",
        sentAt: new Date("2026-08-03T19:59:00.000Z"),
      },
    });

    const response = await POST(webhookRequest({
      event: "messages.update",
      instance: TEST_INSTANCE,
      data: {
        keyId: "test-status-message",
        status: "DELIVERY_ACK",
        timestamp: "2026-08-03T20:00:00.000Z",
      },
    }), { params: Promise.resolve({ slug: ["messages-update"] }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, acceptedEvents: 1, updatedMessages: 1 });
    const message = await prisma.message.findFirst({ where: { externalMessageId: "test-status-message" } });
    expect(message?.deliveryStatus).toBe("delivered");
  });

  it("fails closed without a webhook secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.EVOLUTION_WEBHOOK_SECRET;
    try {
      const response = await POST(webhookRequest(textPayload("test-prod-secret", "5511999990007@s.whatsapp.net")), routeParams());
      expect(response.status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
      process.env.EVOLUTION_API_URL = "http://evolution.test";
      process.env.EVOLUTION_API_KEY = "test-key";
      process.env.EVOLUTION_INSTANCE_NAME = TEST_INSTANCE;
    }
  });

  it("rejects a payload for another Evolution instance", async () => {
    const payload = textPayload("test-wrong-instance", "5511999990008@s.whatsapp.net") as Record<string, unknown>;
    payload.instance = "another-instance";
    const response = await POST(webhookRequest(payload), routeParams());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "invalid_instance" });
  });

  it("rejects oversized payloads before parsing", async () => {
    const response = await POST(new Request("http://localhost/api/whatsapp/webhook/messages-upsert", {
      method: "POST",
      body: JSON.stringify({ instance: TEST_INSTANCE, padding: "x".repeat(262_145) }),
    }), routeParams());
    expect(response.status).toBe(413);
  });
});
