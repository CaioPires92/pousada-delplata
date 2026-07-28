import {
  MetaMessagingProvider,
  metaMessagingConfigFromEnv,
} from "./meta-provider";
import type { MessagingProvider } from "./provider";
import prisma from "@/lib/prisma";

type Environment = Record<string, string | undefined>;
type ProviderFactory = (environment: Environment) => MessagingProvider;
type EvidenceRepository = {
  messagingWebhookEvent: {
    findFirst(args: {
      where: {
        provider: string;
        externalMessageId: string;
        eventKind: string;
      };
      orderBy: { receivedAt: "desc" };
      select: {
        normalizedEventJson: true;
        receivedAt: true;
      };
    }): Promise<{
      normalizedEventJson: string;
      receivedAt: Date;
    } | null>;
  };
};

const DELIVERY_STATUSES = new Set(["sent", "delivered", "read", "failed"]);

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function waitForDeliveryEvidence(
  externalMessageId: string,
  repository: EvidenceRepository,
  timeoutMs: number,
  pollIntervalMs: number,
) {
  const deadline = Date.now() + timeoutMs;

  do {
    const event = await repository.messagingWebhookEvent.findFirst({
      where: {
        provider: "meta",
        externalMessageId,
        eventKind: "status",
      },
      orderBy: { receivedAt: "desc" },
      select: {
        normalizedEventJson: true,
        receivedAt: true,
      },
    });

    if (event) {
      try {
        const normalized = JSON.parse(event.normalizedEventJson) as {
          status?: unknown;
        };
        if (typeof normalized.status === "string" && DELIVERY_STATUSES.has(normalized.status)) {
          return {
            status: normalized.status,
            receivedAt: event.receivedAt.toISOString(),
          };
        }
      } catch {
        // Ignore malformed evidence and keep waiting for a valid status event.
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  } while (Date.now() < deadline);

  throw new Error("Meta delivery webhook evidence was not received before timeout");
}

function defaultProviderFactory(environment: Environment) {
  return new MetaMessagingProvider(metaMessagingConfigFromEnv(environment));
}

export async function runMetaMessagingE2E(
  environment: Environment = process.env,
  providerFactory: ProviderFactory = defaultProviderFactory,
  now: () => Date = () => new Date(),
  evidenceRepository: EvidenceRepository = prisma,
) {
  if (environment.META_E2E_ENABLED !== "true") {
    throw new Error("Meta E2E is disabled; set META_E2E_ENABLED=true explicitly");
  }

  const recipientId = environment.META_WHATSAPP_TEST_RECIPIENT?.trim();
  if (!recipientId || !/^\d{8,15}$/.test(recipientId)) {
    throw new Error("META_WHATSAPP_TEST_RECIPIENT must be an E.164 number without +");
  }
  const webhookTimeoutMs = positiveInteger(
    environment.META_E2E_WEBHOOK_TIMEOUT_MS,
    60_000,
    "META_E2E_WEBHOOK_TIMEOUT_MS",
  );
  const webhookPollIntervalMs = positiveInteger(
    environment.META_E2E_WEBHOOK_POLL_INTERVAL_MS,
    1_000,
    "META_E2E_WEBHOOK_POLL_INTERVAL_MS",
  );

  const provider = providerFactory(environment);
  const sent = await provider.send({
    kind: "text",
    recipientId,
    text: `[Delplata CRM E2E] ${now().toISOString()}`,
  });
  const delivery = await waitForDeliveryEvidence(
    sent.externalMessageId,
    evidenceRepository,
    webhookTimeoutMs,
    webhookPollIntervalMs,
  );

  return {
    ok: true as const,
    provider: provider.name,
    externalMessageId: sent.externalMessageId,
    acceptedAt: sent.acceptedAt,
    status: sent.status,
    delivery,
  };
}
