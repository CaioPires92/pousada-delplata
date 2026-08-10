import prisma from "@/lib/prisma";
import { cancelPendingAutomationJobs } from "@/lib/crm/automationQueue";
import { buildAuditMetadata, type AuditOrigin } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";

export async function cancelCommercialFollowUps(input: {
  conversationId: string;
  contactId: string;
  reason: "customer_replied" | "reservation_started";
  origin: AuditOrigin;
}) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const cards = await tx.pipelineCard.updateMany({
      where: {
        contactId: input.contactId,
        conversationId: input.conversationId,
        followUpAt: { not: null },
      },
      data: { followUpAt: null, lastActivityAt: now },
    });
    const queueJobs = await cancelPendingAutomationJobs({
      conversationId: input.conversationId,
      reason: input.reason,
      now,
      client: tx,
    });
    return { cards: cards.count, queueJobs };
  });

  if (result.cards > 0 || result.queueJobs > 0) {
    await recordCrmEvent({
      action: "CommercialFollowUpsCancelled",
      contactId: input.contactId,
      conversationId: input.conversationId,
      metadata: {
        clearedCards: result.cards,
        cancelledQueueJobs: result.queueJobs,
        ...buildAuditMetadata({ actorType: "system", origin: input.origin, reason: input.reason }),
      },
    });
  }

  return result;
}
