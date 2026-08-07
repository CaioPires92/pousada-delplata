import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import prisma from "@/lib/prisma";

const createdContactIds: string[] = [];

describe("PipelineCard database default", () => {
  afterEach(async () => {
    if (createdContactIds.length > 0) {
      await prisma.contact.deleteMany({ where: { id: { in: createdContactIds.splice(0) } } });
    }
  });

  it("uses NOVO_LEAD even when an insert omits stage", async () => {
    const contact = await prisma.contact.create({
      data: { name: "Contato sintético", source: "test" },
    });
    createdContactIds.push(contact.id);
    const cardId = randomUUID();

    await prisma.$executeRawUnsafe(
      'INSERT INTO "PipelineCard" ("id", "contactId", "updatedAt") VALUES (?, ?, ?)',
      cardId,
      contact.id,
      new Date().toISOString(),
    );

    await expect(prisma.pipelineCard.findUnique({ where: { id: cardId } }))
      .resolves.toMatchObject({ stage: "NOVO_LEAD" });
  });
});
