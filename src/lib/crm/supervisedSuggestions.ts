import prisma from "@/lib/prisma";
import { findApprovedKnowledge } from "@/lib/crm/approvedKnowledge";
import { recordCrmEvent } from "@/lib/crm/events";

export async function createSupervisedSuggestionForInbound(input: {
  conversationId: string;
  contactId: string;
  sourceMessageId: string;
  text: string;
}) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { automationMode: true },
  });
  if (conversation?.automationMode !== "supervised") return null;

  const knowledge = await findApprovedKnowledge(input.text);
  if (!knowledge) return null;

  const suggestion = await prisma.supervisedReplySuggestion.upsert({
    where: { sourceMessageId: input.sourceMessageId },
    create: {
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      content: knowledge.response,
      intent: knowledge.category,
      rolloutIntent: "faq",
      ruleId: knowledge.ruleId,
      ruleVersion: knowledge.version,
    },
    update: {},
  });

  await recordCrmEvent({
    action: "SupervisedReplySuggested",
    contactId: input.contactId,
    conversationId: input.conversationId,
    metadata: {
      suggestionId: suggestion.id,
      sourceMessageId: input.sourceMessageId,
      ruleId: knowledge.ruleId,
      ruleVersion: knowledge.version,
      actionAuthorized: false,
    },
  });

  return suggestion;
}
