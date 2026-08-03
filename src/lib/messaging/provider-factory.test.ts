import { describe, expect, it, vi } from "vitest";
import { EvolutionMessagingProvider } from "./evolution-provider";
import { MetaMessagingProvider } from "./meta-provider";
import {
  createMessagingProvider,
  MessagingProviderConfigurationError,
  messagingProviderNameFromEnv,
} from "./provider-factory";

describe("messaging provider factory", () => {
  it("selects Evolution by default", () => {
    const environment = {
      EVOLUTION_API_URL: "http://evolution.test",
      EVOLUTION_API_KEY: "synthetic-key",
      EVOLUTION_INSTANCE_NAME: "delplata-test",
    };
    expect(messagingProviderNameFromEnv(environment)).toBe("evolution");
    expect(createMessagingProvider(environment, vi.fn())).toBeInstanceOf(EvolutionMessagingProvider);
  });

  it("selects Meta only when explicitly configured", () => {
    const environment = {
      WHATSAPP_PROVIDER: "meta",
      META_WHATSAPP_ACCESS_TOKEN: "synthetic-token",
      META_WHATSAPP_PHONE_NUMBER_ID: "PHONE_TEST",
      META_WHATSAPP_GRAPH_API_VERSION: "v99.0",
    };
    expect(messagingProviderNameFromEnv(environment)).toBe("meta");
    expect(createMessagingProvider(environment, vi.fn())).toBeInstanceOf(MetaMessagingProvider);
  });

  it("fails closed for an unsupported provider", () => {
    expect(() => messagingProviderNameFromEnv({ WHATSAPP_PROVIDER: "unknown" }))
      .toThrow(MessagingProviderConfigurationError);
  });

  it("does not require inactive provider credentials", () => {
    expect(() => createMessagingProvider({
      WHATSAPP_PROVIDER: "evolution",
      EVOLUTION_API_URL: "http://evolution.test",
      EVOLUTION_API_KEY: "synthetic-key",
      EVOLUTION_INSTANCE_NAME: "delplata-test",
    }, vi.fn())).not.toThrow();
  });
});
