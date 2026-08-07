import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

export async function claimCrmEvent(input: {
  eventId: string;
  source: string;
  eventType: string;
}) {
  try {
    await prisma.crmEventReceipt.create({
      data: {
        eventId: input.eventId,
        source: input.source,
        eventType: input.eventType,
      },
    });
    return { claimed: true as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const receipt = await prisma.crmEventReceipt.findUnique({
        where: { eventId: input.eventId },
        select: { status: true, resultJson: true, completedAt: true },
      });
      return { claimed: false as const, receipt };
    }
    throw error;
  }
}

export async function completeCrmEvent(eventId: string, result?: unknown) {
  return prisma.crmEventReceipt.update({
    where: { eventId },
    data: {
      status: "completed",
      completedAt: new Date(),
      resultJson: result === undefined ? undefined : JSON.stringify(result),
    },
  });
}

export async function releaseCrmEvent(eventId: string) {
  await prisma.crmEventReceipt.deleteMany({
    where: { eventId, status: "processing" },
  });
}
