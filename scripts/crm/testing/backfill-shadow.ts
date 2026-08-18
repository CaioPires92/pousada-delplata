import prisma from "../../../src/lib/prisma";
import { classifyIntent } from "../../../src/lib/crm/aiIntentClassifier";
import { parseCrmIntent } from "../../../src/lib/crm/intentParser";
import {
  CRM_AI_PROMPT_VERSION,
  CRM_AUTOMATION_POLICY_VERSION,
} from "../../../src/lib/crm/automationVersions";

type StoredMetadata = {
  sourceMessageId?: unknown;
  promptVersion?: unknown;
  policyVersion?: unknown;
};

const FAQ_HEURISTIC_INTENTS = new Set([
  "checkin_info",
  "checkout_info",
  "amenity",
  "pet",
  "parking",
  "location",
]);

function integerArgument(name: string, fallback: number) {
  const prefix = `--${name}=`;
  const raw = process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`invalid_${name}`);
  return parsed;
}

function parseMetadata(value: string | null): StoredMetadata {
  if (!value) return {};
  try {
    return JSON.parse(value) as StoredMetadata;
  } catch {
    return {};
  }
}

async function main() {
  const commit = process.argv.includes("--commit");
  const limit = Math.min(integerArgument("limit", 20), 100);
  const scan = Math.max(limit, Math.min(integerArgument("scan", 500), 2_000));
  const heuristicIntent = process.argv
    .find(argument => argument.startsWith("--heuristic-intent="))
    ?.slice("--heuristic-intent=".length)
    .trim();

  if (process.env.CRM_AI_SHADOW_MODE !== "true") {
    throw new Error("CRM_AI_SHADOW_MODE_must_be_true");
  }

  const [messages, existingLogs] = await Promise.all([
    prisma.message.findMany({
      where: {
        senderType: "guest",
        messageType: "text",
        content: { not: null },
      },
      orderBy: { sentAt: "desc" },
      take: scan,
      select: {
        id: true,
        conversationId: true,
        content: true,
        conversation: { select: { contactId: true } },
      },
    }),
    prisma.internalActionLog.findMany({
      where: { action: "IntentClassified" },
      orderBy: { createdAt: "desc" },
      take: 10_000,
      select: { metadataJson: true },
    }),
  ]);

  const alreadyEvaluated = new Set(
    existingLogs
      .map(log => parseMetadata(log.metadataJson))
      .filter(metadata =>
        metadata.promptVersion === CRM_AI_PROMPT_VERSION &&
        metadata.policyVersion === CRM_AUTOMATION_POLICY_VERSION &&
        typeof metadata.sourceMessageId === "string"
      )
      .map(metadata => metadata.sourceMessageId as string)
  );

  const candidates = messages
    .filter(message => message.content?.trim() && !alreadyEvaluated.has(message.id))
    .filter(message => {
      if (!heuristicIntent || !message.content) return true;
      const intent = parseCrmIntent(message.content).intent;
      return heuristicIntent === "faq"
        ? FAQ_HEURISTIC_INTENTS.has(intent)
        : intent === heuristicIntent;
    })
    .slice(0, limit);

  if (!commit) {
    console.log(JSON.stringify({
      ok: true,
      mode: "preview",
      scanned: messages.length,
      eligible: candidates.length,
      limit,
      heuristicIntent: heuristicIntent ?? null,
      note: "No provider was called and no database row was created. Use --commit to evaluate.",
    }));
    return;
  }

  let classified = 0;
  let fallback = 0;
  const minimumConfidence = Math.max(
    0.5,
    Number.parseFloat(process.env.CRM_AI_INTENT_MIN_CONFIDENCE ?? "0.7") || 0.7
  );

  for (const message of candidates) {
    const text = message.content?.trim();
    if (!text) continue;

    const heuristic = parseCrmIntent(text);
    const result = await classifyIntent(text);

    await prisma.internalActionLog.create({
      data: {
        action: "IntentClassified",
        contactId: message.conversation.contactId,
        conversationId: message.conversationId,
        metadataJson: JSON.stringify({
          intent: result.intent,
          confidence: result.confidence,
          source: result.source,
          accepted: result.confidence >= minimumConfidence,
          mode: result.evaluationMode,
          actionAuthorized: false,
          heuristicIntent: heuristic.intent,
          agreementWithHeuristic: result.source === "ai" ? result.intent === heuristic.intent : null,
          model: result.model,
          promptVersion: result.promptVersion ?? null,
          decisionSchemaVersion: result.decision?.schemaVersion ?? null,
          policyVersion: CRM_AUTOMATION_POLICY_VERSION,
          sourceMessageId: message.id,
          suggestedAction: result.decision?.suggestedAction ?? null,
          reasonCode: result.decision?.reasonCode ?? null,
          entities: result.decision?.entities ?? {},
          latencyMs: result.latencyMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          providerHttpStatus: result.providerHttpStatus ?? null,
          providerErrorCode: result.providerErrorCode ?? null,
          result: result.result,
          evaluationOrigin: "historical_shadow_backfill",
        }),
      },
    });

    if (result.source === "ai" && result.result === "classified") classified += 1;
    else fallback += 1;
  }

  console.log(JSON.stringify({
    ok: true,
    mode: "commit",
    evaluated: candidates.length,
    classified,
    fallback,
    whatsappMessagesSent: 0,
  }));
}

main()
  .catch(error => {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "unknown_error",
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
