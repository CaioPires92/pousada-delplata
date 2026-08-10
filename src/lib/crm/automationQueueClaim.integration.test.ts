import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";
import {
  enqueueAutomationJob,
  processNextAutomationJobForConversation,
} from "@/lib/crm/automationQueue";

const contactIds: string[] = [];

afterEach(async () => {
  if (contactIds.length > 0) {
    await prisma.contact.deleteMany({ where: { id: { in: contactIds.splice(0) } } });
  }
});

async function createConversation() {
  const suffix = randomUUID();
  const contact = await prisma.contact.create({
    data: {
      name: "Contato scheduler",
      phone: `5511${suffix.replace(/\D/g, "").slice(0, 9).padEnd(9, "8")}`,
      source: "test",
    },
  });
  contactIds.push(contact.id);
  return prisma.conversation.create({
    data: { contactId: contact.id, channel: "whatsapp", status: "open" },
  });
}

describe("automation queue atomic claim", () => {
  it("executes one due job only once with concurrent workers", async () => {
    const conversation = await createConversation();
    const now = new Date("2026-08-10T18:00:00.000Z");
    const job = await enqueueAutomationJob({
      conversationId: conversation.id,
      action: "SEND_WHATSAPP_MESSAGE",
      payload: { target: "5511999999999", text: "Lembrete" },
      journeyType: "commercial_followup",
      dedupeKey: `claim:${conversation.id}:step-1`,
      scheduledAt: new Date(now.getTime() - 1_000),
    });
    let executions = 0;
    const runner = async () => {
      executions += 1;
    };

    await Promise.all([
      processNextAutomationJobForConversation(conversation.id, runner, { now }),
      processNextAutomationJobForConversation(conversation.id, runner, { now }),
    ]);

    expect(executions).toBe(1);
    await expect(prisma.automationQueueJob.findUnique({ where: { id: job.id } }))
      .resolves.toMatchObject({ status: "completed", attempts: 1 });
  });

  it("leaves a future job pending", async () => {
    const conversation = await createConversation();
    const now = new Date("2026-08-10T18:00:00.000Z");
    const job = await enqueueAutomationJob({
      conversationId: conversation.id,
      action: "SEND_WHATSAPP_MESSAGE",
      payload: { target: "5511999999999", text: "Lembrete futuro" },
      journeyType: "commercial_followup",
      dedupeKey: `claim:${conversation.id}:future`,
      scheduledAt: new Date(now.getTime() + 60_000),
    });

    const result = await processNextAutomationJobForConversation(
      conversation.id,
      async () => {
        throw new Error("future job must not run");
      },
      { now },
    );

    expect(result).toMatchObject({ processed: false, queued: false });
    await expect(prisma.automationQueueJob.findUnique({ where: { id: job.id } }))
      .resolves.toMatchObject({ status: "pending", attempts: 0 });
  });
});
