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

function wholePhrasePositions(message: string, trigger: string) {
  if (!message || !trigger) return [];

  const wrappedMessage = ` ${message} `;
  const wrappedTrigger = ` ${trigger} `;
  const positions: number[] = [];
  let cursor = 0;

  while (cursor < wrappedMessage.length) {
    const position = wrappedMessage.indexOf(wrappedTrigger, cursor);
    if (position < 0) break;
    positions.push(position);
    cursor = position + 1;
  }

  return positions;
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

  const candidates = rules.flatMap(rule => {
    const normalizedTrigger = normalizeForMatch(rule.trigger);
    if (normalizedTrigger.length < 2) return [];

    return wholePhrasePositions(normalizedMessage, normalizedTrigger).map(position => ({
      rule,
      position,
      end: position + normalizedTrigger.length,
      triggerLength: normalizedTrigger.length,
    }));
  });

  const selected = candidates
    .sort((left, right) => right.triggerLength - left.triggerLength || left.position - right.position)
    .reduce<typeof candidates>((matches, candidate) => {
      const overlaps = matches.some(match => (
        candidate.position < match.end && candidate.end > match.position
      ));
      if (!overlaps) matches.push(candidate);
      return matches;
    }, [])
    .sort((left, right) => left.position - right.position);

  const uniqueMatches = selected.filter((candidate, index, matches) => (
    matches.findIndex(match => match.rule.response === candidate.rule.response) === index
  ));
  if (uniqueMatches.length === 0) return null;

  const [primary] = uniqueMatches;
  const response = uniqueMatches.length === 1
    ? primary.rule.response
    : uniqueMatches.map((match, index) => `${index + 1}. ${match.rule.response}`).join("\n\n");

  return {
    ruleId: uniqueMatches.map(match => match.rule.id).join(","),
    response,
    category: uniqueMatches.length === 1 ? primary.rule.category : "multiple",
    version: Math.max(...uniqueMatches.map(match => match.rule.version)),
  };
}
