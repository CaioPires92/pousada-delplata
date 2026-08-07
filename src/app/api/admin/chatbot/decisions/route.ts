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

  const logs = await prisma.internalActionLog.findMany({
    where: { action: "IntentClassified" },
    orderBy: { createdAt: "desc" },
    take: 25,
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
  });

  const decisions = logs.map(log => {
    const metadata = readMetadata(log.metadataJson);
    const inputTokens = finiteNumber(metadata.inputTokens);
    const outputTokens = finiteNumber(metadata.outputTokens);

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
    };
  });

  return NextResponse.json({ ok: true, decisions });
}
