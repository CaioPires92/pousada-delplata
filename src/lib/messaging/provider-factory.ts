import {
  EvolutionMessagingProvider,
  evolutionMessagingConfigFromEnv,
} from "./evolution-provider";
import {
  MetaMessagingProvider,
  metaMessagingConfigFromEnv,
} from "./meta-provider";
import type { MessagingProvider } from "./provider";

export type MessagingProviderName = "evolution" | "meta";

export class MessagingProviderConfigurationError extends Error {
  constructor(readonly provider: string) {
    super(`Unsupported WhatsApp provider: ${provider}`);
    this.name = "MessagingProviderConfigurationError";
  }
}

export function messagingProviderNameFromEnv(
  environment: Record<string, string | undefined> = process.env,
): MessagingProviderName {
  const provider = environment.WHATSAPP_PROVIDER?.trim().toLowerCase() || "evolution";
  if (provider === "evolution" || provider === "meta") return provider;
  throw new MessagingProviderConfigurationError(provider);
}

export function createMessagingProvider(
  environment: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): MessagingProvider {
  const provider = messagingProviderNameFromEnv(environment);
  if (provider === "meta") {
    return new MetaMessagingProvider(metaMessagingConfigFromEnv(environment), fetchImpl);
  }
  return new EvolutionMessagingProvider(evolutionMessagingConfigFromEnv(environment), fetchImpl);
}
