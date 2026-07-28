import {
  MetaMessagingProvider,
  metaMessagingConfigFromEnv,
} from "./meta-provider";
import type { MessagingProvider } from "./provider";

type Environment = Record<string, string | undefined>;
type ProviderFactory = (environment: Environment) => MessagingProvider;

function defaultProviderFactory(environment: Environment) {
  return new MetaMessagingProvider(metaMessagingConfigFromEnv(environment));
}

export async function runMetaMessagingE2E(
  environment: Environment = process.env,
  providerFactory: ProviderFactory = defaultProviderFactory,
  now: () => Date = () => new Date(),
) {
  if (environment.META_E2E_ENABLED !== "true") {
    throw new Error("Meta E2E is disabled; set META_E2E_ENABLED=true explicitly");
  }

  const recipientId = environment.META_WHATSAPP_TEST_RECIPIENT?.trim();
  if (!recipientId || !/^\d{8,15}$/.test(recipientId)) {
    throw new Error("META_WHATSAPP_TEST_RECIPIENT must be an E.164 number without +");
  }

  const provider = providerFactory(environment);
  const sent = await provider.send({
    kind: "text",
    recipientId,
    text: `[Delplata CRM E2E] ${now().toISOString()}`,
  });

  return {
    ok: true as const,
    provider: provider.name,
    externalMessageId: sent.externalMessageId,
    acceptedAt: sent.acceptedAt,
    status: sent.status,
  };
}
