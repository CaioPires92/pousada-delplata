import type {
  MessageDeliveryStatus,
  NormalizedInboundContent,
  NormalizedMessagingEvent,
} from "./provider";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function string(...values: unknown[]) {
  return values.find(value => typeof value === "string" && value.trim()) as string | undefined;
}

function eventName(payload: JsonRecord) {
  return string(payload.event)?.toLowerCase().replaceAll("_", ".");
}

function occurredAt(payload: JsonRecord, data: JsonRecord) {
  const raw = data.messageTimestamp ?? data.timestamp ?? payload.date_time ?? payload.timestamp;
  if (typeof raw === "string" && /[T-]/.test(raw) && !Number.isNaN(Date.parse(raw))) {
    return new Date(raw).toISOString();
  }
  const numeric = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric).toISOString();
  }
  return new Date(0).toISOString();
}

function inboundContent(message: JsonRecord, messageType?: string): NormalizedInboundContent {
  const extended = record(message.extendedTextMessage);
  const image = record(message.imageMessage);
  const document = record(message.documentMessage);
  const button = record(message.buttonsResponseMessage) ?? record(message.templateButtonReplyMessage);
  const list = record(message.listResponseMessage);

  const text = string(message.conversation, extended?.text);
  if (text) return { kind: "text", text };
  if (button) {
    return {
      kind: "button",
      id: string(button.selectedButtonId, button.selectedId) ?? "unknown",
      title: string(button.selectedDisplayText, button.selectedText) ?? "unknown",
    };
  }
  if (list) {
    const row = record(list.singleSelectReply);
    return {
      kind: "list",
      id: string(row?.selectedRowId, list.selectedRowId) ?? "unknown",
      title: string(list.title, row?.title, row?.selectedRowId) ?? "unknown",
      ...(string(list.description, row?.description) ? { description: string(list.description, row?.description) } : {}),
    };
  }
  if (image) {
    return {
      kind: "image",
      mediaId: string(image.mediaKey, image.directPath, image.url) ?? "unavailable",
      ...(string(image.mimetype) ? { mimeType: string(image.mimetype) } : {}),
      ...(string(image.caption) ? { caption: string(image.caption) } : {}),
    };
  }
  if (document) {
    return {
      kind: "document",
      mediaId: string(document.mediaKey, document.directPath, document.url) ?? "unavailable",
      ...(string(document.fileName) ? { filename: string(document.fileName) } : {}),
      ...(string(document.mimetype) ? { mimeType: string(document.mimetype) } : {}),
      ...(string(document.caption) ? { caption: string(document.caption) } : {}),
    };
  }
  return { kind: "unknown", rawType: messageType ?? "unknown" };
}

function deliveryStatus(value: unknown): MessageDeliveryStatus | undefined {
  const normalized = String(value ?? "").toLowerCase();
  if (["sent", "server_ack", "1", "2"].includes(normalized)) return "sent";
  if (["delivered", "delivery_ack", "3"].includes(normalized)) return "delivered";
  if (["read", "played", "4"].includes(normalized)) return "read";
  if (["failed", "error", "-1"].includes(normalized)) return "failed";
  return undefined;
}

export function normalizeEvolutionWebhook(payload: unknown): ReadonlyArray<NormalizedMessagingEvent> {
  const root = record(payload);
  if (!root) return [];
  const data = record(root.data) ?? record(root.body) ?? root;
  const key = record(data.key) ?? record(root.key);
  const name = eventName(root);
  const messageId = string(key?.id, data.keyId, data.messageId, root.messageId);
  if (!messageId) return [];

  if (name === "messages.upsert") {
    const message = record(data.message) ?? record(root.message);
    const remoteJid = string(key?.remoteJid, data.remoteJid, data.sender);
    const alternateJid = string(key?.remoteJidAlt, data.remoteJidAlt);
    const senderId = remoteJid?.endsWith("@lid") && alternateJid
      ? alternateJid
      : remoteJid;
    const recipientId = string(data.instanceId, root.instance, root.instanceName);
    if (!message || !senderId || !recipientId) return [];
    const timestamp = occurredAt(root, data);
    return [{
      kind: "message",
      externalEventId: `evolution:message:${messageId}`,
      externalMessageId: messageId,
      channel: "whatsapp",
      senderId,
      recipientId,
      occurredAt: timestamp,
      content: inboundContent(message, string(data.messageType, root.messageType)),
    }];
  }

  if (name === "messages.update" || name === "send.message") {
    const status = deliveryStatus(data.status ?? data.update ?? root.status);
    if (!status) return [];
    const timestamp = occurredAt(root, data);
    const error = record(data.error) ?? record(root.error);
    return [{
      kind: "status",
      externalEventId: `evolution:status:${messageId}:${status}:${timestamp}`,
      externalMessageId: messageId,
      channel: "whatsapp",
      status,
      occurredAt: timestamp,
      ...(status === "failed" && error ? {
        error: {
          ...(string(error.code) ? { code: string(error.code) } : {}),
          ...(string(error.message, error.title) ? { title: string(error.message, error.title) } : {}),
          retryable: false,
        },
      } : {}),
    }];
  }

  return [];
}
