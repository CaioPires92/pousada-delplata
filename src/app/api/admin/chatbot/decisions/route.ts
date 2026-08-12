import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";

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

  const reviewByDecisionId = new Map<string, { verdict: string; reviewedAt: Date; reviewedBy: string | null }>();
  for (const review of reviews) {
    const reviewMetadata = readMetadata(review.metadataJson);
    const decisionId = optionalString(reviewMetadata.decisionId);
    const verdict = optionalString(reviewMetadata.verdict);
    if (decisionId && verdict && !reviewByDecisionId.has(decisionId)) {
      reviewByDecisionId.set(decisionId, { verdict, reviewedAt: review.createdAt, reviewedBy: review.userId });
    }
  }

  const decisions = logs.map(log => {
    const metadata = readMetadata(log.metadataJson);
    const inputTokens = finiteNumber(metadata.inputTokens);
    const outputTokens = finiteNumber(metadata.outputTokens);

    const review = reviewByDecisionId.get(log.id);
    return {
      id: log.id,
      createdAt: log.createdAt,
      conversationId: log.conversationId,
      contactLabel: log.conversation?.contact.name || log.conversation?.contact.phone || "Contato",
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
    decision.mode === "shadow" && decision.source === "ai" && decision.result === "classified"
  );
  const comparable = shadowDecisions.filter(decision => decision.agreementWithHeuristic !== null);
  const agreements = comparable.filter(decision => decision.agreementWithHeuristic === true).length;
  const authorizedActions = shadowDecisions.filter(decision => decision.actionAuthorized).length;

  return NextResponse.json({
    ok: true,
    windowStartedAt,
    decisions,
    summary: {
      sampled: shadowDecisions.length,
      shadow: shadowDecisions.length,
      diagnostics: decisions.length - shadowDecisions.length,
      pendingReview: shadowDecisions.filter(decision => !decision.reviewVerdict).length,
      authorizedActions,
      agreementRate: comparable.length > 0 ? agreements / comparable.length : null,
      gatePassed: shadowDecisions.length > 0 && authorizedActions === 0,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const decisionId = typeof body?.decisionId === "string" ? body.decisionId.trim() : "";
  const verdict = body?.verdict;
  if (!decisionId || (verdict !== "approved" && verdict !== "rejected")) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const decision = await prisma.internalActionLog.findFirst({
    where: { id: decisionId, action: "IntentClassified" },
    select: { id: true, conversationId: true, metadataJson: true },
  });
  const decisionMetadata = decision ? readMetadata(decision.metadataJson) : {};
  if (
    !decision ||
    decisionMetadata.mode !== "shadow" ||
    decisionMetadata.source !== "ai" ||
    decisionMetadata.result !== "classified"
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
      metadataJson: JSON.stringify({ decisionId, verdict, origin: "admin_ui" }),
    },
  });

  return NextResponse.json({ ok: true, decisionId, verdict });
}
