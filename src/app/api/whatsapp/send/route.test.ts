import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { POST } from "./route";

vi.mock("@/lib/messaging/provider-factory", () => {
  return { createMessagingProvider: vi.fn() };
});

import { createMessagingProvider } from "@/lib/messaging/provider-factory";

const authMocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdminAuth: authMocks.requireAdminAuth,
}));

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
  await prisma.automationQueueJob.deleteMany({ where: { conversation: { contactId: { in: contactIds } } } });
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
    authMocks.requireAdminAuth.mockResolvedValue({
      adminId: "admin-1",
      email: "recepcao@delplata.com.br",
      role: "admin",
    });
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("persists an Evolution send failure so it can be retried safely", async () => {
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
    expect(body).toEqual({
      ok: false,
      error: "messaging_send_failed",
      messageId: expect.any(String),
    });

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

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: body.messageId,
      content: "Mensagem manual",
      senderType: "human",
      deliveryStatus: "failed",
      deliveryErrorCode: "request_failed",
      deliveryErrorTitle: "Falha ao enviar",
    });
    expect(messages[0].metadataJson).toBe('{"provider":"evolution"}');
    expect(failureLog).not.toBeNull();
    expect(failureLog?.metadataJson).toContain("request_failed");
    expect(failureLog?.metadataJson).not.toContain("evolution offline");
  });

  it("rejects manual sends without an authenticated administrator", async () => {
    authMocks.requireAdminAuth.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const response = await POST(request({
      conversationId: "conversation-1",
      text: "Mensagem manual",
    }));

    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("persists a successful provider result without its raw response", async () => {
    send.mockResolvedValue({
      externalMessageId: "EVO_MANUAL_001",
      acceptedAt: "2026-08-03T19:00:00.000Z",
      status: "sent",
    });
    const contact = await prisma.contact.create({
      data: {
        name: "Teste envio sucesso",
        phone: "551188880002",
        lid: "998877665544332",
        whatsappJid: "998877665544332@lid",
        source: "test-whatsapp-send",
      },
    });
    const customerMessageAt = new Date(Date.now() - 60_000);
    const conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        channel: "whatsapp",
        status: "open",
        lastCustomerMessageAt: customerMessageAt,
        firstCustomerMessageAt: customerMessageAt,
        awaitingHumanResponse: true,
        waitingSince: customerMessageAt,
      },
    });
    const pendingSend = await prisma.automationQueueJob.create({
      data: {
        conversationId: conversation.id,
        action: "SEND_WHATSAPP_MESSAGE",
        payloadJson: JSON.stringify({ target: "551188880002", text: "Resposta antiga" }),
        status: "pending",
      },
    });
    const pendingN8n = await prisma.automationQueueJob.create({
      data: {
        conversationId: conversation.id,
        action: "EMIT_N8N_EVENT",
        payloadJson: JSON.stringify({ event: { type: "MessageReceived" } }),
        status: "pending",
      },
    });

    const response = await POST(request({ conversationId: conversation.id, text: "Mensagem manual" }));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith({
      kind: "text",
      recipientId: "551188880002",
      text: "Mensagem manual",
    });
    const message = await prisma.message.findFirst({ where: { externalMessageId: "EVO_MANUAL_001" } });
    const updatedConversation = await prisma.conversation.findUnique({ where: { id: conversation.id } });
    const takeoverLog = await prisma.internalActionLog.findFirst({
      where: { conversationId: conversation.id, action: "HumanTookOver" },
    });
    const [cancelledSend, preservedN8n] = await Promise.all([
      prisma.automationQueueJob.findUnique({ where: { id: pendingSend.id } }),
      prisma.automationQueueJob.findUnique({ where: { id: pendingN8n.id } }),
    ]);
    expect(message?.metadataJson).toContain('"provider":"evolution"');
    expect(message?.metadataJson).not.toContain("Mensagem manual");
    expect(message?.deliveryStatus).toBe("sent");
    expect(message?.deliveryUpdatedAt?.toISOString()).toBe("2026-08-03T19:00:00.000Z");
    expect(updatedConversation?.assignedUserId).toBe("admin-1");
    expect(updatedConversation?.automationPausedUntil).not.toBeNull();
    expect(updatedConversation?.awaitingHumanResponse).toBe(false);
    expect(updatedConversation?.waitingSince).toBeNull();
    expect(updatedConversation?.firstHumanResponseAt).not.toBeNull();
    expect(updatedConversation?.firstResponseTimeSeconds).toBeGreaterThanOrEqual(60);
    expect(takeoverLog?.metadataJson).toContain('"actorId":"admin-1"');
    expect(takeoverLog?.metadataJson).toContain('"cancelledJobs":1');
    expect(cancelledSend).toMatchObject({
      status: "cancelled",
      cancelReason: "human_manual_message",
    });
    expect(cancelledSend?.cancelledAt).not.toBeNull();
    expect(preservedN8n?.status).toBe("pending");
  });
});
