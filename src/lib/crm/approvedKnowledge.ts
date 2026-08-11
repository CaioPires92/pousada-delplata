import prisma from "@/lib/prisma";

export type ApprovedKnowledgeMatch = {
  ruleId: string;
  response: string;
  category: string;
  version: number;
};

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bwi fi\b/g, "wifi")
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
    where: {
      isActive: true,
      audience: "public",
      approvedAt: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      trigger: true,
      response: true,
      category: true,
      version: true,
    },
  });

  const matched = rules
    .map(rule => ({ rule, normalizedTrigger: normalizeForMatch(rule.trigger) }))
    .filter(({ normalizedTrigger }) => (
      normalizedTrigger.length >= 2 && matchesWholePhrase(normalizedMessage, normalizedTrigger)
    ))
    .sort((left, right) => right.normalizedTrigger.length - left.normalizedTrigger.length)[0]?.rule;

  return matched
    ? { ruleId: matched.id, response: matched.response, category: matched.category, version: matched.version }
    : null;
}
