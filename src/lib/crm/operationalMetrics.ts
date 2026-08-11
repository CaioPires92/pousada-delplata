import prisma from "@/lib/prisma";
import { checkEvolutionMessagingHealth } from "@/lib/messaging/evolution-health";
import { evolutionMessagingConfigFromEnv } from "@/lib/messaging/evolution-provider";
import { checkMetaMessagingHealth, metaMessagingHealthConfigFromEnv } from "@/lib/messaging/meta-health";
import { messagingProviderNameFromEnv } from "@/lib/messaging/provider-factory";

type DecisionMetadata = {
  latencyMs?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
};

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function parseDecisionMetadata(value: string | null): DecisionMetadata {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function configuredTokenPrice(name: string) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function getActiveMessagingHealth() {
  try {
    const provider = messagingProviderNameFromEnv();
    const result = provider === "evolution"
      ? await checkEvolutionMessagingHealth(evolutionMessagingConfigFromEnv())
      : await checkMetaMessagingHealth(metaMessagingHealthConfigFromEnv());
    return { provider, ...result };
  } catch {
    return { provider: "unknown", status: "unconfigured" as const };
  }
}

export async function getCrmOperationalMetrics(
  since: Date,
  now = new Date(),
  client: typeof prisma = prisma,
  messagingHealthCheck = getActiveMessagingHealth,
) {
  const [decisions, errorCount, failedJobs, overdueJobs, openDeadLetters, messaging] = await Promise.all([
    client.internalActionLog.findMany({
      where: { action: "IntentClassified", createdAt: { gte: since } },
      select: { metadataJson: true },
    }),
    client.internalActionLog.count({
      where: {
        action: { in: ["WhatsAppSendFailed", "WebhookProcessingFailed", "AutomationJobFailed"] },
        createdAt: { gte: since },
      },
    }),
    client.automationQueueJob.count({ where: { status: "failed", finishedAt: { gte: since } } }),
    client.automationQueueJob.count({ where: { status: "pending", scheduledAt: { lt: now } } }),
    client.deadLetterQueueItem.count({ where: { status: "open" } }),
    messagingHealthCheck(),
  ]);

  const metadata = decisions.map(item => parseDecisionMetadata(item.metadataJson));
  const latencies = metadata.map(item => finiteNumber(item.latencyMs)).filter(value => value > 0).sort((a, b) => a - b);
  const inputTokens = metadata.reduce((total, item) => total + finiteNumber(item.inputTokens), 0);
  const outputTokens = metadata.reduce((total, item) => total + finiteNumber(item.outputTokens), 0);
  const inputPrice = configuredTokenPrice("CRM_AI_INPUT_USD_PER_1M_TOKENS");
  const outputPrice = configuredTokenPrice("CRM_AI_OUTPUT_USD_PER_1M_TOKENS");
  const estimatedCostUsd = inputPrice === null || outputPrice === null
    ? null
    : Number((((inputTokens * inputPrice) + (outputTokens * outputPrice)) / 1_000_000).toFixed(4));
  const totalErrors = errorCount + failedJobs;
  const health = messaging.status !== "healthy" || openDeadLetters > 0 || totalErrors >= 5
    ? "critical"
    : totalErrors > 0 || overdueJobs > 0
      ? "warning"
      : "healthy";

  return {
    health,
    messaging,
    latency: {
      samples: latencies.length,
      averageMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      p95Ms: latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)] : null,
    },
    errors: { total: totalErrors, eventFailures: errorCount, failedJobs },
    queue: { overdueJobs, openDeadLetters },
    aiCost: { inputTokens, outputTokens, estimatedCostUsd, configured: estimatedCostUsd !== null },
  };
}
