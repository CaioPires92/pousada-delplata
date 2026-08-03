import prisma from "@/lib/prisma";
import { EvolutionMessagingProvider, evolutionMessagingConfigFromEnv } from "./evolution-provider";
import type { MessagingProvider } from "./provider";

type Environment = Record<string, string | undefined>;
type EvidenceRepository = {
  messagingWebhookEvent: {
    findFirst(args: {
      where: { provider: string; externalMessageId: string; eventKind: string };
      orderBy: { receivedAt: "desc" };
      select: { normalizedEventJson: true; receivedAt: true };
    }): Promise<{ normalizedEventJson: string; receivedAt: Date } | null>;
  };
};

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

async function waitForEvidence(id: string, repository: EvidenceRepository, timeoutMs: number, intervalMs: number) {
  const deadline = Date.now() + timeoutMs;
  do {
    const event = await repository.messagingWebhookEvent.findFirst({
      where: { provider: "evolution", externalMessageId: id, eventKind: "status" },
      orderBy: { receivedAt: "desc" },
      select: { normalizedEventJson: true, receivedAt: true },
    });
    if (event) {
      try {
        const normalized = JSON.parse(event.normalizedEventJson) as { status?: unknown };
        if (["sent", "delivered", "read", "failed"].includes(String(normalized.status))) {
          return { status: String(normalized.status), receivedAt: event.receivedAt.toISOString() };
        }
      } catch {
        // Aguarda uma evidência normalizada válida.
      }
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  throw new Error("Evolution delivery webhook evidence was not received before timeout");
}

export async function runEvolutionMessagingE2E(
  environment: Environment = process.env,
  providerFactory: (environment: Environment) => MessagingProvider = env =>
    new EvolutionMessagingProvider(evolutionMessagingConfigFromEnv(env)),
  now: () => Date = () => new Date(),
  repository: EvidenceRepository = prisma,
) {
  if (environment.EVOLUTION_E2E_ENABLED !== "true") {
    throw new Error("Evolution E2E is disabled; set EVOLUTION_E2E_ENABLED=true explicitly");
  }
  const recipientId = environment.EVOLUTION_TEST_RECIPIENT?.trim();
  if (!recipientId || !/^\d{8,15}$/.test(recipientId)) {
    throw new Error("EVOLUTION_TEST_RECIPIENT must be an E.164 number without +");
  }
  const timeoutMs = positiveInteger(environment.EVOLUTION_E2E_WEBHOOK_TIMEOUT_MS, 60_000, "EVOLUTION_E2E_WEBHOOK_TIMEOUT_MS");
  const intervalMs = positiveInteger(environment.EVOLUTION_E2E_WEBHOOK_POLL_INTERVAL_MS, 1_000, "EVOLUTION_E2E_WEBHOOK_POLL_INTERVAL_MS");
  const provider = providerFactory(environment);
  const sent = await provider.send({
    kind: "text",
    recipientId,
    text: `[Delplata CRM Evolution E2E] ${now().toISOString()}`,
  });
  const delivery = await waitForEvidence(sent.externalMessageId, repository, timeoutMs, intervalMs);
  return {
    ok: true as const,
    provider: "evolution" as const,
    externalMessageId: sent.externalMessageId,
    acceptedAt: sent.acceptedAt,
    status: sent.status,
    delivery,
  };
}
