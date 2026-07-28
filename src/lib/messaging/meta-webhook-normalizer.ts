import {
  MESSAGE_DELIVERY_STATUSES,
  type MessageDeliveryStatus,
  type NormalizedInboundContent,
  type NormalizedMessagingEvent,
} from "./provider";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function asRecords(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is UnknownRecord => item !== null)
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function timestampToIso(value: unknown) {
  const timestamp = stringValue(value);
  if (!timestamp || !/^\d+$/.test(timestamp)) return undefined;
  const date = new Date(Number(timestamp) * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeContent(message: UnknownRecord): NormalizedInboundContent {
  const type = stringValue(message.type) ?? "unknown";

  if (type === "text") {
    const text = asRecord(message.text);
    const body = stringValue(text?.body);
    if (body) return { kind: "text", text: body };
  }

  if (type === "interactive") {
    const interactive = asRecord(message.interactive);
    if (interactive?.type === "button_reply") {
      const reply = asRecord(interactive.button_reply);
      const id = stringValue(reply?.id);
      const title = stringValue(reply?.title);
      if (id && title) return { kind: "button", id, title };
    }
    if (interactive?.type === "list_reply") {
      const reply = asRecord(interactive.list_reply);
      const id = stringValue(reply?.id);
      const title = stringValue(reply?.title);
      if (id && title) {
        const description = stringValue(reply?.description);
        return { kind: "list", id, title, ...(description ? { description } : {}) };
      }
    }
  }

  if (type === "image") {
    const image = asRecord(message.image);
    const mediaId = stringValue(image?.id);
    if (mediaId) {
      const mimeType = stringValue(image?.mime_type);
      const caption = stringValue(image?.caption);
      return {
        kind: "image",
        mediaId,
        ...(mimeType ? { mimeType } : {}),
        ...(caption ? { caption } : {}),
      };
    }
  }

  if (type === "document") {
    const document = asRecord(message.document);
    const mediaId = stringValue(document?.id);
    if (mediaId) {
      const filename = stringValue(document?.filename);
      const mimeType = stringValue(document?.mime_type);
      const caption = stringValue(document?.caption);
      return {
        kind: "document",
        mediaId,
        ...(filename ? { filename } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(caption ? { caption } : {}),
      };
    }
  }

  return { kind: "unknown", rawType: type };
}

function normalizeMessage(
  message: UnknownRecord,
  recipientId: string,
): NormalizedMessagingEvent | null {
  const externalMessageId = stringValue(message.id);
  const senderId = stringValue(message.from);
  const occurredAt = timestampToIso(message.timestamp);
  if (!externalMessageId || !senderId || !occurredAt) return null;

  return {
    kind: "message",
    externalEventId: `message:${externalMessageId}`,
    externalMessageId,
    channel: "whatsapp",
    senderId,
    recipientId,
    occurredAt,
    content: normalizeContent(message),
  };
}

function normalizeStatus(status: UnknownRecord): NormalizedMessagingEvent | null {
  const externalMessageId = stringValue(status.id);
  const statusValue = stringValue(status.status);
  const occurredAt = timestampToIso(status.timestamp);
  if (
    !externalMessageId
    || !statusValue
    || !occurredAt
    || !MESSAGE_DELIVERY_STATUSES.includes(statusValue as MessageDeliveryStatus)
  ) {
    return null;
  }

  const firstError = asRecords(status.errors)[0];
  const errorData = asRecord(firstError?.error_data);
  const code = firstError?.code === undefined ? undefined : String(firstError.code);
  const title = stringValue(firstError?.title);
  const detail = stringValue(errorData?.details) ?? stringValue(firstError?.message);
  const error = code || title || detail
    ? {
        ...(code ? { code } : {}),
        ...(title ? { title } : {}),
        ...(detail ? { detail } : {}),
      }
    : undefined;

  return {
    kind: "status",
    externalEventId: `status:${externalMessageId}:${statusValue}:${status.timestamp}`,
    externalMessageId,
    channel: "whatsapp",
    status: statusValue as MessageDeliveryStatus,
    occurredAt,
    ...(error ? { error } : {}),
  };
}

export function normalizeMetaWebhook(payload: unknown): NormalizedMessagingEvent[] {
  const root = asRecord(payload);
  if (root?.object !== "whatsapp_business_account") return [];

  const events: NormalizedMessagingEvent[] = [];

  for (const entry of asRecords(root.entry)) {
    for (const change of asRecords(entry.changes)) {
      if (change.field !== "messages") continue;
      const value = asRecord(change.value);
      if (value?.messaging_product !== "whatsapp") continue;
      const metadata = asRecord(value.metadata);
      const recipientId = stringValue(metadata?.phone_number_id);

      if (recipientId) {
        for (const message of asRecords(value.messages)) {
          const normalized = normalizeMessage(message, recipientId);
          if (normalized) events.push(normalized);
        }
      }

      for (const status of asRecords(value.statuses)) {
        const normalized = normalizeStatus(status);
        if (normalized) events.push(normalized);
      }
    }
  }

  return events;
}
