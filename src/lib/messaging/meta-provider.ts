import { normalizeMetaWebhook } from "./meta-webhook-normalizer";
import type {
  MessagingProvider,
  NormalizedMessagingEvent,
  OutboundMessage,
  SendMessageResult,
} from "./provider";

type FetchLike = typeof fetch;

export type MetaMessagingProviderConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
};

export class MetaMessagingProviderError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "unsupported_message" | "request_failed" | "invalid_response",
    readonly status?: number,
  ) {
    super(message);
    this.name = "MetaMessagingProviderError";
  }
}

function requireConfigValue(value: string | undefined, name: string) {
  if (!value?.trim()) {
    throw new MetaMessagingProviderError(
      `Missing Meta messaging configuration: ${name}`,
      "not_configured",
    );
  }
  return value.trim();
}

export function metaMessagingConfigFromEnv(): MetaMessagingProviderConfig {
  return {
    accessToken: requireConfigValue(
      process.env.META_WHATSAPP_ACCESS_TOKEN,
      "META_WHATSAPP_ACCESS_TOKEN",
    ),
    phoneNumberId: requireConfigValue(
      process.env.META_WHATSAPP_PHONE_NUMBER_ID,
      "META_WHATSAPP_PHONE_NUMBER_ID",
    ),
    graphApiVersion: requireConfigValue(
      process.env.META_WHATSAPP_GRAPH_API_VERSION,
      "META_WHATSAPP_GRAPH_API_VERSION",
    ),
  };
}

export class MetaMessagingProvider implements MessagingProvider {
  readonly name = "meta";

  constructor(
    private readonly config: MetaMessagingProviderConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async normalizeWebhook(payload: unknown): Promise<ReadonlyArray<NormalizedMessagingEvent>> {
    return normalizeMetaWebhook(payload);
  }

  async send(message: OutboundMessage): Promise<SendMessageResult> {
    if (message.kind !== "text") {
      throw new MetaMessagingProviderError(
        "Meta template sending is not implemented",
        "unsupported_message",
      );
    }

    const response = await this.fetchImpl(
      `https://graph.facebook.com/${encodeURIComponent(this.config.graphApiVersion)}/${encodeURIComponent(this.config.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: message.recipientId,
          ...(message.replyToExternalMessageId
            ? { context: { message_id: message.replyToExternalMessageId } }
            : {}),
          type: "text",
          text: {
            preview_url: false,
            body: message.text,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new MetaMessagingProviderError(
        "Meta message request failed",
        "request_failed",
        response.status,
      );
    }

    const payload = await response.json() as {
      messages?: Array<{ id?: unknown }>;
    };
    const externalMessageId = payload.messages?.[0]?.id;

    if (typeof externalMessageId !== "string" || !externalMessageId) {
      throw new MetaMessagingProviderError(
        "Meta message response did not contain an external message ID",
        "invalid_response",
        response.status,
      );
    }

    return {
      externalMessageId,
      acceptedAt: this.now().toISOString(),
      status: "accepted",
    };
  }
}
