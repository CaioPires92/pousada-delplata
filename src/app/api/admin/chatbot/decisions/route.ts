import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import { AI_INTENTS } from "@/lib/crm/aiDecision";
import { AI_DECISION_SCHEMA_VERSION } from "@/lib/crm/aiDecision";
import { CRM_AI_PROMPT_VERSION, CRM_AUTOMATION_POLICY_VERSION } from "@/lib/crm/automationVersions";
import prisma from "@/lib/prisma";

const validExpectedIntents = new Set<string>(AI_INTENTS);

function readMetadata(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.slice(0, 120) : null;
}

export async function GET() {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const now = new Date();
  const windowStartedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [logs, reviews] = await Promise.all([
    prisma.internalActionLog.findMany({
    where: {
      action: "IntentClassified",
      createdAt: { gte: windowStartedAt },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      conversationId: true,
      metadataJson: true,
      conversation: {
        select: {
          contact: {
            select: { name: true, phone: true },
          },
        },
      },
    },
    }),
    prisma.internalActionLog.findMany({
      where: { action: "AiDecisionReviewed", createdAt: { gte: windowStartedAt } },
      orderBy: { createdAt: "desc" },
      select: { metadataJson: true, createdAt: true, userId: true },
    }),
  ]);

  const sourceMessageIds = logs
    .map(log => optionalString(readMetadata(log.metadataJson).sourceMessageId))
    .filter((messageId): messageId is string => Boolean(messageId));
  const sourceMessages = sourceMessageIds.length > 0
    ? await prisma.message.findMany({
      where: { id: { in: sourceMessageIds }, senderType: "guest" },
      select: { id: true, content: true },
    })
    : [];
  const sourceMessageById = new Map(sourceMessages.map(message => [message.id, message.content]));

  const reviewByDecisionId = new Map<string, {
    verdict: string;
    expectedIntent: string | null;
    reviewedAt: Date;
    reviewedBy: string | null;
  }>();
  for (const review of reviews) {
    const reviewMetadata = readMetadata(review.metadataJson);
    const decisionId = optionalString(reviewMetadata.decisionId);
    const verdict = optionalString(reviewMetadata.verdict);
    if (decisionId && verdict && !reviewByDecisionId.has(decisionId)) {
      reviewByDecisionId.set(decisionId, {
        verdict,
        expectedIntent: optionalString(reviewMetadata.expectedIntent),
        reviewedAt: review.createdAt,
        reviewedBy: review.userId,
      });
    }
  }

  const decisions = logs.map(log => {
    const metadata = readMetadata(log.metadataJson);
    const inputTokens = finiteNumber(metadata.inputTokens);
    const outputTokens = finiteNumber(metadata.outputTokens);
    const sourceMessageId = optionalString(metadata.sourceMessageId);
    const currentVersion = metadata.promptVersion === CRM_AI_PROMPT_VERSION
      && metadata.decisionSchemaVersion === AI_DECISION_SCHEMA_VERSION
      && metadata.policyVersion === CRM_AUTOMATION_POLICY_VERSION;

    const review = reviewByDecisionId.get(log.id);
    return {
      id: log.id,
      createdAt: log.createdAt,
      conversationId: log.conversationId,
      contactLabel: log.conversation?.contact.name || log.conversation?.contact.phone || "Contato",
      currentVersion,
      sourceMessageId,
      sourceMessageExcerpt: sourceMessageId
        ? (sourceMessageById.get(sourceMessageId)?.trim().slice(0, 280) || null)
        : null,
      intent: optionalString(metadata.intent) ?? "unknown",
      heuristicIntent: optionalString(metadata.heuristicIntent),
      confidence: finiteNumber(metadata.confidence),
      source: optionalString(metadata.source) ?? "unknown",
      mode: optionalString(metadata.mode) ?? "deterministic",
      accepted: metadata.accepted === true,
      actionAuthorized: metadata.actionAuthorized === true,
      agreementWithHeuristic: typeof metadata.agreementWithHeuristic === "boolean"
        ? metadata.agreementWithHeuristic
        : null,
      suggestedAction: optionalString(metadata.suggestedAction),
      reasonCode: optionalString(metadata.reasonCode),
      model: optionalString(metadata.model),
      result: optionalString(metadata.result),
      latencyMs: finiteNumber(metadata.latencyMs),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens !== null || outputTokens !== null
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : null,
      reviewVerdict: review?.verdict ?? null,
      expectedIntent: review?.expectedIntent ?? null,
      reviewedAt: review?.reviewedAt ?? null,
      reviewedBy: review?.reviewedBy ?? null,
    };
  }).sort((left, right) => {
    const leftValid = left.mode === "shadow" && left.source === "ai" && left.result === "classified";
    const rightValid = right.mode === "shadow" && right.source === "ai" && right.result === "classified";
    if (leftValid !== rightValid) return leftValid ? -1 : 1;
    if (leftValid && rightValid && Boolean(left.reviewVerdict) !== Boolean(right.reviewVerdict)) {
      return left.reviewVerdict ? 1 : -1;
    }
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const shadowDecisions = decisions.filter(decision =>
    decision.mode === "shadow" && decision.source === "ai" && decision.result === "classified" && decision.currentVersion
  );
  const obsoleteShadowDecisions = decisions.filter(decision =>
    decision.mode === "shadow" && decision.source === "ai" && decision.result === "classified" && !decision.currentVersion
  );
  const comparable = shadowDecisions.filter(decision => decision.agreementWithHeuristic !== null);
  const agreements = comparable.filter(decision => decision.agreementWithHeuristic === true).length;
  const authorizedActions = shadowDecisions.filter(decision => decision.actionAuthorized).length;
  const intentSummary = new Map<string, {
    intent: string;
    sampled: number;
    reviewed: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number | null;
  }>();
  for (const decision of shadowDecisions) {
    const intent = decision.suggestedAction === "answer_approved_faq" ? "faq" : decision.intent;
    const current = intentSummary.get(intent) ?? {
      intent,
      sampled: 0,
      reviewed: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      approvalRate: null,
    };
    current.sampled += 1;
    if (decision.reviewVerdict === "approved") {
      current.reviewed += 1;
      current.approved += 1;
    } else if (decision.reviewVerdict === "rejected") {
      current.reviewed += 1;
      current.rejected += 1;
    } else {
      current.pending += 1;
    }
    current.approvalRate = current.reviewed > 0 ? current.approved / current.reviewed : null;
    intentSummary.set(intent, current);
  }
  const correctionSummary = new Map<string, {
    predictedIntent: string;
    expectedIntent: string;
    count: number;
  }>();
  for (const decision of shadowDecisions) {
    if (decision.reviewVerdict !== "rejected" || !decision.expectedIntent) continue;
    const predictedIntent = decision.suggestedAction === "answer_approved_faq" ? "faq" : decision.intent;
    const key = `${predictedIntent}:${decision.expectedIntent}`;
    const current = correctionSummary.get(key) ?? {
      predictedIntent,
      expectedIntent: decision.expectedIntent,
      count: 0,
    };
    current.count += 1;
    correctionSummary.set(key, current);
  }

  return NextResponse.json({
    ok: true,
    windowStartedAt,
    decisions,
    summary: {
      sampled: shadowDecisions.length,
      shadow: shadowDecisions.length,
      diagnostics: decisions.length - shadowDecisions.length,
      obsoleteVersions: obsoleteShadowDecisions.length,
      pendingReview: shadowDecisions.filter(decision => !decision.reviewVerdict).length,
      authorizedActions,
      agreementRate: comparable.length > 0 ? agreements / comparable.length : null,
      shadowSafetyPassed: shadowDecisions.length > 0 && authorizedActions === 0,
      byIntent: [...intentSummary.values()].sort((left, right) => left.intent.localeCompare(right.intent)),
      corrections: [...correctionSummary.values()].sort((left, right) => (
        right.count - left.count
        || left.predictedIntent.localeCompare(right.predictedIntent)
        || left.expectedIntent.localeCompare(right.expectedIntent)
      )),
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const decisionId = typeof body?.decisionId === "string" ? body.decisionId.trim() : "";
  const verdict = body?.verdict;
  const expectedIntent = typeof body?.expectedIntent === "string" ? body.expectedIntent.trim() : "";
  if (!decisionId || (verdict !== "approved" && verdict !== "rejected")) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  if (verdict === "rejected" && !validExpectedIntents.has(expectedIntent)) {
    return NextResponse.json({ ok: false, error: "expected_intent_required" }, { status: 400 });
  }

  const windowStartedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const decision = await prisma.internalActionLog.findFirst({
    where: {
      id: decisionId,
      action: "IntentClassified",
      createdAt: { gte: windowStartedAt },
    },
    select: { id: true, conversationId: true, metadataJson: true },
  });
  const decisionMetadata = decision ? readMetadata(decision.metadataJson) : {};
  if (
    !decision ||
    decisionMetadata.mode !== "shadow" ||
    decisionMetadata.source !== "ai" ||
    decisionMetadata.result !== "classified"
    || decisionMetadata.promptVersion !== CRM_AI_PROMPT_VERSION
    || decisionMetadata.decisionSchemaVersion !== AI_DECISION_SCHEMA_VERSION
    || decisionMetadata.policyVersion !== CRM_AUTOMATION_POLICY_VERSION
  ) {
    return NextResponse.json({ ok: false, error: "decision_not_found" }, { status: 404 });
  }

  const existingReview = await prisma.internalActionLog.findFirst({
    where: {
      action: "AiDecisionReviewed",
      metadataJson: { contains: `\"decisionId\":\"${decisionId}\"` },
    },
    select: { id: true },
  });
  if (existingReview) {
    return NextResponse.json({ ok: false, error: "already_reviewed" }, { status: 409 });
  }

  await prisma.internalActionLog.create({
    data: {
      action: "AiDecisionReviewed",
      userId: auth.adminId,
      conversationId: decision.conversationId,
      metadataJson: JSON.stringify({
        decisionId,
        verdict,
        expectedIntent: verdict === "rejected" ? expectedIntent : null,
        origin: "admin_ui",
      }),
    },
  });

  return NextResponse.json({ ok: true, decisionId, verdict });
}
