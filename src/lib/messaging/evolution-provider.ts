import type {
  MessagingProvider,
  NormalizedMessagingEvent,
  OutboundMessage,
  SendMessageResult,
} from "./provider";

type FetchLike = typeof fetch;
type Sleep = (delayMs: number) => Promise<void>;

export type EvolutionMessagingProviderConfig = {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
};

export type EvolutionMessagingRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: Sleep;
};

export class EvolutionMessagingProviderError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "invalid_message" | "request_failed" | "invalid_response",
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "EvolutionMessagingProviderError";
  }
}

function required(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new EvolutionMessagingProviderError(
      `Missing Evolution messaging configuration: ${name}`,
      "not_configured",
    );
  }
  return normalized;
}

export function evolutionMessagingConfigFromEnv(
  environment: Record<string, string | undefined> = process.env,
): EvolutionMessagingProviderConfig {
  return {
    apiUrl: required(environment.EVOLUTION_API_URL, "EVOLUTION_API_URL").replace(/\/+$/, ""),
    apiKey: required(environment.EVOLUTION_API_KEY, "EVOLUTION_API_KEY"),
    instanceName: required(environment.EVOLUTION_INSTANCE_NAME, "EVOLUTION_INSTANCE_NAME"),
  };
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function externalMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : undefined;
  const keyCandidate = root.key ?? data?.key;
  const key = keyCandidate && typeof keyCandidate === "object" ? keyCandidate as Record<string, unknown> : undefined;
  const candidates = [root.id, root.messageId, data?.id, data?.messageId, key?.id];
  return candidates.find(value => typeof value === "string" && value.trim()) as string | undefined;
}

function normalizeRecipient(recipientId: string) {
  const value = recipientId.trim();
  if (/^\d{8,15}$/.test(value) || /^\d+@(s\.whatsapp\.net|lid)$/.test(value)) return value;
  throw new EvolutionMessagingProviderError(
    "Invalid Evolution message recipient",
    "invalid_message",
  );
}

export class EvolutionMessagingProvider implements MessagingProvider {
  readonly name = "evolution";

  constructor(
    private readonly config: EvolutionMessagingProviderConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly retryOptions: EvolutionMessagingRetryOptions = {},
  ) {}

  async normalizeWebhook(_payload: unknown): Promise<ReadonlyArray<NormalizedMessagingEvent>> {
    return [];
  }

  async send(message: OutboundMessage): Promise<SendMessageResult> {
    if (message.kind !== "text" || !message.text.trim()) {
      throw new EvolutionMessagingProviderError(
        "Evolution provider currently accepts non-empty text messages only",
        "invalid_message",
      );
    }

    const response = await this.fetchWithRetry(
      `${this.config.apiUrl}/message/sendText/${encodeURIComponent(this.config.instanceName)}`,
      {
        method: "POST",
        headers: {
          apikey: this.config.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          number: normalizeRecipient(message.recipientId),
          text: message.text,
          ...(message.replyToExternalMessageId
            ? { quoted: { key: { id: message.replyToExternalMessageId } } }
            : {}),
        }),
      },
    );

    if (!response.ok) {
      throw new EvolutionMessagingProviderError(
        "Evolution message request failed",
        "request_failed",
        response.status,
        isTransientStatus(response.status),
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new EvolutionMessagingProviderError(
        "Evolution message response was invalid",
        "invalid_response",
        response.status,
      );
    }

    const messageId = externalMessageId(payload);
    if (!messageId) {
      throw new EvolutionMessagingProviderError(
        "Evolution message response did not contain an external message ID",
        "invalid_response",
        response.status,
      );
    }

    return {
      externalMessageId: messageId.trim(),
      acceptedAt: this.now().toISOString(),
      status: "sent",
    };
  }

  private async fetchWithRetry(url: string, init: RequestInit) {
    const maxAttempts = Math.max(1, Math.floor(this.retryOptions.maxAttempts ?? 3));
    const baseDelayMs = Math.max(0, this.retryOptions.baseDelayMs ?? 250);
    const maxDelayMs = Math.max(baseDelayMs, this.retryOptions.maxDelayMs ?? 5_000);
    const sleep = this.retryOptions.sleep ?? (delay => new Promise<void>(resolve => setTimeout(resolve, delay)));

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, init);
        if (!isTransientStatus(response.status) || attempt === maxAttempts) return response;
      } catch {
        if (attempt === maxAttempts) {
          throw new EvolutionMessagingProviderError(
            "Evolution message request failed",
            "request_failed",
            undefined,
            true,
          );
        }
      }

      await sleep(Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1))));
    }

    throw new EvolutionMessagingProviderError(
      "Evolution message request failed",
      "request_failed",
      undefined,
      true,
    );
  }
}
