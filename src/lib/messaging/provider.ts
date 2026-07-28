export const MESSAGE_DELIVERY_STATUSES = [
  "sent",
  "delivered",
  "read",
  "failed",
] as const;

export type MessageDeliveryStatus = typeof MESSAGE_DELIVERY_STATUSES[number];

export type NormalizedInboundContent =
  | { kind: "text"; text: string }
  | { kind: "button"; id: string; title: string }
  | { kind: "list"; id: string; title: string; description?: string }
  | { kind: "image"; mediaId: string; mimeType?: string; caption?: string }
  | { kind: "document"; mediaId: string; filename?: string; mimeType?: string; caption?: string }
  | { kind: "unknown"; rawType: string };

export type NormalizedInboundMessage = {
  kind: "message";
  externalEventId: string;
  externalMessageId: string;
  channel: "whatsapp";
  senderId: string;
  recipientId: string;
  occurredAt: string;
  content: NormalizedInboundContent;
};

export type NormalizedStatusEvent = {
  kind: "status";
  externalEventId: string;
  externalMessageId: string;
  channel: "whatsapp";
  status: MessageDeliveryStatus;
  occurredAt: string;
  error?: {
    code?: string;
    title?: string;
    detail?: string;
    retryable?: boolean;
  };
};

export type NormalizedMessagingEvent =
  | NormalizedInboundMessage
  | NormalizedStatusEvent;

export type OutboundMessage =
  | {
      kind: "text";
      recipientId: string;
      text: string;
      replyToExternalMessageId?: string;
    }
  | {
      kind: "template";
      recipientId: string;
      templateName: string;
      languageCode: string;
      parameters: ReadonlyArray<string>;
    };

export type SendMessageResult = {
  externalMessageId: string;
  acceptedAt: string;
  status: "accepted" | "sent";
};

export interface MessagingProvider {
  readonly name: string;
  normalizeWebhook(payload: unknown): Promise<ReadonlyArray<NormalizedMessagingEvent>>;
  send(message: OutboundMessage): Promise<SendMessageResult>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

export function isNormalizedMessagingEvent(value: unknown): value is NormalizedMessagingEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;

  if (
    !isNonEmptyString(event.externalEventId)
    || !isNonEmptyString(event.externalMessageId)
    || event.channel !== "whatsapp"
    || !isIsoDate(event.occurredAt)
  ) {
    return false;
  }

  if (event.kind === "status") {
    return MESSAGE_DELIVERY_STATUSES.includes(event.status as MessageDeliveryStatus);
  }

  if (event.kind !== "message" || !isNonEmptyString(event.senderId) || !isNonEmptyString(event.recipientId)) {
    return false;
  }

  if (!event.content || typeof event.content !== "object") return false;
  const content = event.content as Record<string, unknown>;

  switch (content.kind) {
    case "text":
      return isNonEmptyString(content.text);
    case "button":
    case "list":
      return isNonEmptyString(content.id) && isNonEmptyString(content.title);
    case "image":
    case "document":
      return isNonEmptyString(content.mediaId);
    case "unknown":
      return isNonEmptyString(content.rawType);
    default:
      return false;
  }
}
