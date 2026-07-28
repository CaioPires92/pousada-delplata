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
    readonly code: "not_configured" | "invalid_message" | "request_failed" | "invalid_response",
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
    const requestPayload = message.kind === "text"
      ? {
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
        }
      : this.buildTemplatePayload(message);

    const response = await this.fetchImpl(
      `https://graph.facebook.com/${encodeURIComponent(this.config.graphApiVersion)}/${encodeURIComponent(this.config.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
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

  private buildTemplatePayload(message: Extract<OutboundMessage, { kind: "template" }>) {
    if (!/^[a-z0-9_]+$/.test(message.templateName)) {
      throw new MetaMessagingProviderError(
        "Invalid Meta template name",
        "invalid_message",
      );
    }
    if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(message.languageCode)) {
      throw new MetaMessagingProviderError(
        "Invalid Meta template language code",
        "invalid_message",
      );
    }

    const parameters = message.parameters.map(parameter => {
      if (parameter.type === "text") {
        if (!parameter.text.trim()) {
          throw new MetaMessagingProviderError(
            "Meta template text parameter cannot be empty",
            "invalid_message",
          );
        }
        return { type: "text", text: parameter.text };
      }

      if (parameter.type === "currency") {
        const { fallbackValue, code, amount1000 } = parameter.currency;
        if (
          !fallbackValue.trim()
          || !/^[A-Z]{3}$/.test(code)
          || !Number.isSafeInteger(amount1000)
        ) {
          throw new MetaMessagingProviderError(
            "Invalid Meta template currency parameter",
            "invalid_message",
          );
        }
        return {
          type: "currency",
          currency: {
            fallback_value: fallbackValue,
            code,
            amount_1000: amount1000,
          },
        };
      }

      if (!parameter.dateTime.fallbackValue.trim()) {
        throw new MetaMessagingProviderError(
          "Meta template date/time parameter cannot be empty",
          "invalid_message",
        );
      }
      return {
        type: "date_time",
        date_time: {
          fallback_value: parameter.dateTime.fallbackValue,
        },
      };
    });

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.recipientId,
      type: "template",
      template: {
        name: message.templateName,
        language: { code: message.languageCode },
        ...(parameters.length > 0
          ? { components: [{ type: "body", parameters }] }
          : {}),
      },
    };
  }
}
