import { afterAll, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";
import { replayDeadLetterItem } from "@/lib/crm/automationQueue";
import { isWhatsappChatbotGloballyEnabled } from "@/lib/crm/chatbotSettings";

const ids = {
  settings: "drill-settings",
  contact: "drill-contact",
  conversation: "drill-conversation",
  deadLetter: "drill-dead-letter",
};

afterAll(async () => {
  await prisma.automationQueueJob.deleteMany({ where: { conversationId: ids.conversation } });
  await prisma.deadLetterQueueItem.deleteMany({ where: { id: ids.deadLetter } });
  await prisma.conversation.deleteMany({ where: { id: ids.conversation } });
  await prisma.contact.deleteMany({ where: { id: ids.contact } });
  await prisma.chatbotSettings.deleteMany({ where: { id: ids.settings } });
  await prisma.$disconnect();
});

describe("CRM operational recovery drill", () => {
  it("trips the kill switch, restores configuration and replays one dead-letter item", async () => {
    await prisma.chatbotSettings.create({
      data: {
        id: ids.settings,
        enabledGlobal: true,
        enabledWhatsapp: true,
      },
    });
    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(true);

    await prisma.chatbotSettings.update({
      where: { id: ids.settings },
      data: { enabledGlobal: false, enabledWhatsapp: false },
    });
    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(false);

    await prisma.contact.create({
      data: { id: ids.contact, name: "Operational drill", source: "test" },
    });
    await prisma.conversation.create({
      data: {
        id: ids.conversation,
        contactId: ids.contact,
        channel: "whatsapp",
        status: "open",
        automationMode: "off",
        chatbotEnabled: false,
      },
    });
    await prisma.deadLetterQueueItem.create({
      data: {
        id: ids.deadLetter,
        conversationId: ids.conversation,
        source: "operational_drill",
        action: "SEND_WHATSAPP_MESSAGE",
        reason: "injected_provider_failure",
        payloadJson: JSON.stringify({ target: "5511999999999", text: "Mensagem de ensaio" }),
      },
    });

    const replay = await replayDeadLetterItem({ deadLetterId: ids.deadLetter });
    expect(replay.ok).toBe(true);
    await expect(prisma.deadLetterQueueItem.findUnique({ where: { id: ids.deadLetter } }))
      .resolves.toMatchObject({ status: "replayed", replayedAt: expect.any(Date) });
    await expect(prisma.automationQueueJob.findUnique({ where: { id: replay.ok ? replay.jobId : "" } }))
      .resolves.toMatchObject({ status: "pending", journeyType: "replay" });

    // Rollback do ensaio: a configuração original é restaurada, mas a conversa
    // permanece explicitamente desligada para que o replay nunca envie sozinho.
    await prisma.chatbotSettings.update({
      where: { id: ids.settings },
      data: { enabledGlobal: true, enabledWhatsapp: true },
    });
    await expect(isWhatsappChatbotGloballyEnabled()).resolves.toBe(true);
    await expect(prisma.conversation.findUnique({ where: { id: ids.conversation } }))
      .resolves.toMatchObject({ automationMode: "off", chatbotEnabled: false });
  });
});
