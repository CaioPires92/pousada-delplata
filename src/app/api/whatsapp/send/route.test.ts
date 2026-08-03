import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { POST } from "./route";

vi.mock("@/lib/messaging/provider-factory", () => {
  return { createMessagingProvider: vi.fn() };
});

import { createMessagingProvider } from "@/lib/messaging/provider-factory";

const send = vi.fn();

function request(body: unknown) {
  return new Request("http://localhost/api/whatsapp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function cleanupTestData() {
  const contacts = await prisma.contact.findMany({
    where: { source: "test-whatsapp-send" },
    select: { id: true },
  });
  const contactIds = contacts.map(contact => contact.id);

  if (contactIds.length === 0) return;

  await prisma.internalActionLog.deleteMany({ where: { contactId: { in: contactIds } } });
  await prisma.pipelineCard.deleteMany({ where: { contactId: { in: contactIds } } });
  await prisma.conversation.deleteMany({ where: { contactId: { in: contactIds } } });
  await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
}

describe("manual WhatsApp send hardening", () => {
  beforeEach(async () => {
    send.mockReset();
    vi.mocked(createMessagingProvider).mockReturnValue({
      name: "evolution",
      normalizeWebhook: vi.fn(),
      send,
    });
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("logs Evolution send failures and does not create a message", async () => {
    send.mockRejectedValue(Object.assign(new Error("evolution offline"), { code: "request_failed" }));

    const contact = await prisma.contact.create({
      data: {
        name: "Teste envio falha",
        phone: "551188880001",
        source: "test-whatsapp-send",
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        channel: "whatsapp",
        status: "open",
      },
    });

    const response = await POST(request({
      conversationId: conversation.id,
      text: "Mensagem manual",
    }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ ok: false, error: "messaging_send_failed" });

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
    });
    const failureLog = await prisma.internalActionLog.findFirst({
      where: {
        contactId: contact.id,
        conversationId: conversation.id,
        action: "WhatsAppSendFailed",
      },
    });

    expect(messages).toHaveLength(0);
    expect(failureLog).not.toBeNull();
    expect(failureLog?.metadataJson).toContain("request_failed");
    expect(failureLog?.metadataJson).not.toContain("evolution offline");
  });

  it("persists a successful provider result without its raw response", async () => {
    send.mockResolvedValue({
      externalMessageId: "EVO_MANUAL_001",
      acceptedAt: "2026-08-03T19:00:00.000Z",
      status: "sent",
    });
    const contact = await prisma.contact.create({
      data: { name: "Teste envio sucesso", phone: "551188880002", source: "test-whatsapp-send" },
    });
    const conversation = await prisma.conversation.create({
      data: { contactId: contact.id, channel: "whatsapp", status: "open" },
    });

    const response = await POST(request({ conversationId: conversation.id, text: "Mensagem manual" }));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith({
      kind: "text",
      recipientId: "551188880002",
      text: "Mensagem manual",
    });
    const message = await prisma.message.findFirst({ where: { externalMessageId: "EVO_MANUAL_001" } });
    expect(message?.metadataJson).toContain('"provider":"evolution"');
    expect(message?.metadataJson).not.toContain("Mensagem manual");
  });
});
