import prisma from "@/lib/prisma";

export type ApprovedKnowledgeMatch = {
  ruleId: string;
  response: string;
  category: string;
};

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesWholePhrase(message: string, trigger: string) {
  if (!message || !trigger) return false;
  return message === trigger || ` ${message} `.includes(` ${trigger} `);
}

export async function findApprovedKnowledge(message: string): Promise<ApprovedKnowledgeMatch | null> {
  const normalizedMessage = normalizeForMatch(message);
  if (!normalizedMessage) return null;

  const rules = await prisma.chatbotRule.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      trigger: true,
      response: true,
      category: true,
    },
  });

  const matched = rules.find(rule => {
    const normalizedTrigger = normalizeForMatch(rule.trigger);
    return normalizedTrigger.length >= 2 && matchesWholePhrase(normalizedMessage, normalizedTrigger);
  });

  return matched
    ? { ruleId: matched.id, response: matched.response, category: matched.category }
    : null;
}
