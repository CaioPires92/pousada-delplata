import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { POST } from "./route";

vi.mock("@/lib/whatsapp/evolution", async () => {
  const actual = await vi.importActual<typeof import("@/lib/whatsapp/evolution")>("@/lib/whatsapp/evolution");

  return {
    ...actual,
    sendEvolutionTextWithRetry: vi.fn(),
  };
});

import { sendEvolutionTextWithRetry } from "@/lib/whatsapp/evolution";

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
    vi.mocked(sendEvolutionTextWithRetry).mockReset();
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("logs Evolution send failures and does not create a message", async () => {
    vi.mocked(sendEvolutionTextWithRetry).mockRejectedValue(new Error("evolution offline"));

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
    expect(body).toEqual({ ok: false, error: "evolution_send_failed" });

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
    expect(failureLog?.metadataJson).toContain("evolution offline");
  });
});
