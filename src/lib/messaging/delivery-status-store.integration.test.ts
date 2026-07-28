import { afterEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { persistMessageDeliveryStatus } from "./delivery-status-store";

const source = "test-meta-delivery-status";

async function cleanup() {
  await prisma.contact.deleteMany({ where: { source } });
}

describe("message delivery status database persistence", () => {
  afterEach(cleanup);

  it("persists the newest correlated status and ignores an older event", async () => {
    const contact = await prisma.contact.create({
      data: { source, phone: "551199990099" },
    });
    const conversation = await prisma.conversation.create({
      data: { contactId: contact.id, channel: "whatsapp" },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        externalMessageId: "wamid.TEST_DELIVERY_ORDER",
        senderType: "agent",
        content: "Mensagem sintética",
        sentAt: new Date("2026-07-28T12:00:00.000Z"),
      },
    });

    await persistMessageDeliveryStatus({
      kind: "status",
      externalEventId: "status:wamid.TEST_DELIVERY_ORDER:read:1785254430",
      externalMessageId: "wamid.TEST_DELIVERY_ORDER",
      channel: "whatsapp",
      status: "read",
      occurredAt: "2026-07-28T12:00:30.000Z",
    });
    await expect(persistMessageDeliveryStatus({
      kind: "status",
      externalEventId: "status:wamid.TEST_DELIVERY_ORDER:sent:1785254410",
      externalMessageId: "wamid.TEST_DELIVERY_ORDER",
      channel: "whatsapp",
      status: "sent",
      occurredAt: "2026-07-28T12:00:10.000Z",
    })).resolves.toEqual({ matchedMessages: 0 });

    await expect(prisma.message.findFirstOrThrow({
      where: { externalMessageId: "wamid.TEST_DELIVERY_ORDER" },
      select: {
        deliveryStatus: true,
        deliveryUpdatedAt: true,
      },
    })).resolves.toEqual({
      deliveryStatus: "read",
      deliveryUpdatedAt: new Date("2026-07-28T12:00:30.000Z"),
    });
  });
});
