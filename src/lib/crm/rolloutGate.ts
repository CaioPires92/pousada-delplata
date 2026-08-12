import prisma from "@/lib/prisma";
import type { AutoReplyIntent } from "@/lib/crm/chatbotSettings";
import { AI_DECISION_SCHEMA_VERSION } from "@/lib/crm/aiDecision";
import { CRM_AI_PROMPT_VERSION, CRM_AUTOMATION_POLICY_VERSION } from "@/lib/crm/automationVersions";

type DecisionMetadata = {
  mode?: unknown;
  source?: unknown;
  result?: unknown;
  actionAuthorized?: unknown;
  agreementWithHeuristic?: unknown;
  verdict?: unknown;
  decisionId?: unknown;
  intent?: unknown;
  suggestedAction?: unknown;
  promptVersion?: unknown;
  decisionSchemaVersion?: unknown;
  policyVersion?: unknown;
};

function positiveIntegerEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function metadata(value: string | null): DecisionMetadata {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export type AutoReplyRolloutGate = {
  approved: boolean;
  reasons: string[];
  metrics: {
    shadowSample: number;
    shadowAgreementRate: number | null;
    shadowAuthorizedActions: number;
    supervisedReviewed: number;
    supervisedObsolete: number;
    humanShadowReviewed: number;
    humanShadowApprovalRate: number | null;
  };
  requirements: {
    minimumShadowSample: number;
    minimumShadowAgreementRate: number;
    minimumSupervisedReviews: number;
    minimumHumanShadowReviews: number;
    minimumHumanShadowApprovalRate: number;
  };
};

export async function evaluateAutoReplyRolloutGate(
  now = new Date(),
  rolloutIntent?: AutoReplyIntent,
): Promise<AutoReplyRolloutGate> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [logs, humanReviews, supervisedCandidates] = await Promise.all([
    prisma.internalActionLog.findMany({
      where: { action: "IntentClassified", createdAt: { gte: since } },
      select: { id: true, metadataJson: true },
    }),
    prisma.internalActionLog.findMany({
      where: { action: "AiDecisionReviewed", createdAt: { gte: since } },
      select: { metadataJson: true },
    }),
    prisma.supervisedReplySuggestion.findMany({
      where: {
        status: { in: ["approved", "dismissed"] },
        reviewedAt: { gte: since },
        ...(rolloutIntent === "faq"
          ? { rolloutIntent: "faq" }
          : rolloutIntent
            ? { intent: rolloutIntent }
            : {}),
      },
      select: { ruleId: true, ruleVersion: true, content: true },
    }),
  ]);
  const ruleIds = [...new Set(supervisedCandidates.flatMap(suggestion => (
    suggestion.ruleId.split(",").map(id => id.trim()).filter(Boolean)
  )))];
  const currentRules = ruleIds.length
    ? await prisma.chatbotRule.findMany({
        where: {
          id: { in: ruleIds },
          isActive: true,
          audience: "public",
          approvedAt: { not: null },
        },
        select: { id: true, version: true, response: true },
      })
    : [];
  const currentRuleById = new Map(currentRules.map(rule => [rule.id, rule]));
  const supervisedReviewed = supervisedCandidates.filter(suggestion => {
    const suggestionRuleIds = suggestion.ruleId.split(",").map(id => id.trim()).filter(Boolean);
    const rules = suggestionRuleIds.map(id => currentRuleById.get(id));
    if (suggestionRuleIds.length === 0 || rules.some(rule => !rule)) return false;

    const validRules = rules.filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));
    const currentVersion = Math.max(...validRules.map(rule => rule.version));
    const currentContent = validRules.length === 1
      ? validRules[0].response
      : validRules.map((rule, index) => `${index + 1}. ${rule.response}`).join("\n\n");
    return suggestion.ruleVersion === currentVersion && suggestion.content === currentContent;
  }).length;
  const supervisedObsolete = supervisedCandidates.length - supervisedReviewed;
  const shadow = logs
    .map(log => ({ id: log.id, ...metadata(log.metadataJson) }))
    .filter(item => item.mode === "shadow" && item.source === "ai" && item.result === "classified")
    .filter(item => (
      item.promptVersion === CRM_AI_PROMPT_VERSION
      && item.decisionSchemaVersion === AI_DECISION_SCHEMA_VERSION
      && item.policyVersion === CRM_AUTOMATION_POLICY_VERSION
    ))
    .filter(item => !rolloutIntent || (
      rolloutIntent === "faq"
        ? item.suggestedAction === "answer_approved_faq"
        : item.intent === rolloutIntent
    ));
  const comparable = shadow.filter(item => typeof item.agreementWithHeuristic === "boolean");
  const agreements = comparable.filter(item => item.agreementWithHeuristic === true).length;
  const agreementRate = comparable.length ? agreements / comparable.length : null;
  const authorizedActions = shadow.filter(item => item.actionAuthorized === true).length;
  const validDecisionIds = new Set(shadow.map(item => item.id));
  const reviewByDecisionId = new Map<string, "approved" | "rejected">();
  for (const log of humanReviews) {
    const review = metadata(log.metadataJson);
    if (
      typeof review.decisionId === "string" &&
      validDecisionIds.has(review.decisionId) &&
      (review.verdict === "approved" || review.verdict === "rejected") &&
      !reviewByDecisionId.has(review.decisionId)
    ) {
      reviewByDecisionId.set(review.decisionId, review.verdict);
    }
  }
  const reviewedVerdicts = [...reviewByDecisionId.values()];
  const humanApprovals = reviewedVerdicts.filter(verdict => verdict === "approved").length;
  const humanApprovalRate = reviewedVerdicts.length ? humanApprovals / reviewedVerdicts.length : null;
  const minimumShadow = positiveIntegerEnv("CRM_ROLLOUT_MIN_SHADOW_SAMPLE", 20);
  const minimumSupervised = positiveIntegerEnv("CRM_ROLLOUT_MIN_SUPERVISED_REVIEWS", 5);
  const minimumHumanShadowReviews = positiveIntegerEnv("CRM_ROLLOUT_MIN_HUMAN_SHADOW_REVIEWS", 10);
  const reasons: string[] = [];
  if (shadow.length < minimumShadow) reasons.push("insufficient_shadow_sample");
  if (agreementRate === null || agreementRate < 0.8) reasons.push("shadow_agreement_below_threshold");
  if (authorizedActions > 0) reasons.push("shadow_action_was_authorized");
  if (supervisedReviewed < minimumSupervised) reasons.push("insufficient_supervised_reviews");
  if (reviewedVerdicts.length < minimumHumanShadowReviews) reasons.push("insufficient_human_shadow_reviews");
  if (humanApprovalRate === null || humanApprovalRate < 0.8) reasons.push("human_shadow_approval_below_threshold");

  return {
    approved: reasons.length === 0,
    reasons,
    metrics: {
      shadowSample: shadow.length,
      shadowAgreementRate: agreementRate,
      shadowAuthorizedActions: authorizedActions,
      supervisedReviewed,
      supervisedObsolete,
      humanShadowReviewed: reviewedVerdicts.length,
      humanShadowApprovalRate: humanApprovalRate,
    },
    requirements: {
      minimumShadowSample: minimumShadow,
      minimumShadowAgreementRate: 0.8,
      minimumSupervisedReviews: minimumSupervised,
      minimumHumanShadowReviews: minimumHumanShadowReviews,
      minimumHumanShadowApprovalRate: 0.8,
    },
  };
}
