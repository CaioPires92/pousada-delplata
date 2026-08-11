import type { CrmEventInput } from "@/lib/crm/events";

export const N8N_EVENT_ALLOWLIST = [
  "LeadCreated",
  "MessageReceived",
  "AutomationHandoffRequested",
  "WhatsAppSendFailed",
  "WebhookProcessingFailed",
  "QuoteSent",
  "ReservationStarted",
  "PaymentPending",
  "PaymentApproved",
  "BookingConfirmed",
  "CheckoutConfirmed",
  "PipelineStageChanged",
  "PostStayIssueDetected",
  "HumanTookOver",
  "AutomationPaused",
] as const;

export type N8nAllowedEvent = typeof N8N_EVENT_ALLOWLIST[number];

export type N8nEventEnvelope = {
  schemaVersion: 1;
  eventId: string;
  eventType: N8nAllowedEvent;
  occurredAt: string;
  entityId: string;
  correlationId: string;
  causationId: string;
  resources: {
    contactId?: string;
    conversationId?: string;
    bookingId?: string;
  };
  data: Record<string, string | number | boolean | null>;
};

const ALLOWED_METADATA: Record<N8nAllowedEvent, readonly string[]> = {
  LeadCreated: ["source"],
  MessageReceived: ["channel", "messageType"],
  AutomationHandoffRequested: ["reason", "messageSent"],
  WhatsAppSendFailed: ["provider", "errorCode", "textLength"],
  WebhookProcessingFailed: ["reason"],
  QuoteSent: ["checkin", "checkout", "adults", "children", "optionsCount", "cheapestTotal", "messageSent"],
  ReservationStarted: ["source"],
  PaymentPending: ["provider", "paymentStatus"],
  PaymentApproved: ["provider", "paymentStatus"],
  BookingConfirmed: ["provider", "bookingStatus"],
  CheckoutConfirmed: ["source", "checkoutAt"],
  PipelineStageChanged: ["fromStage", "toStage", "actorType"],
  PostStayIssueDetected: ["source"],
  HumanTookOver: ["pauseStrategy", "pauseMinutes"],
  AutomationPaused: ["pauseStrategy", "pauseMinutes"],
};

function isAllowedEvent(action: string): action is N8nAllowedEvent {
  return (N8N_EVENT_ALLOWLIST as readonly string[]).includes(action);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

function sanitizeScalar(value: unknown): string | number | boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value.slice(0, 200);
  return undefined;
}

export function buildN8nEventEnvelope(input: {
  eventId: string;
  occurredAt: Date | string;
  event: CrmEventInput;
}): N8nEventEnvelope | null {
  if (!isAllowedEvent(input.event.action)) return null;

  const occurredAt = input.occurredAt instanceof Date
    ? input.occurredAt.toISOString()
    : new Date(input.occurredAt).toISOString();
  const allowedMetadata = ALLOWED_METADATA[input.event.action];
  const data: N8nEventEnvelope["data"] = {};

  for (const key of allowedMetadata) {
    const sanitized = sanitizeScalar(input.event.metadata?.[key]);
    if (sanitized !== undefined) data[key] = sanitized;
  }

  return {
    schemaVersion: 1,
    eventId: input.eventId,
    eventType: input.event.action,
    occurredAt,
    entityId: input.event.conversationId
      ?? input.event.bookingId
      ?? input.event.contactId
      ?? input.eventId,
    correlationId: input.event.correlationId
      ?? input.event.conversationId
      ?? input.event.bookingId
      ?? input.event.contactId
      ?? input.eventId,
    causationId: input.event.causationId ?? input.eventId,
    resources: {
      ...(input.event.contactId ? { contactId: input.event.contactId } : {}),
      ...(input.event.conversationId ? { conversationId: input.event.conversationId } : {}),
      ...(input.event.bookingId ? { bookingId: input.event.bookingId } : {}),
    },
    data,
  };
}

export function parseN8nEventEnvelope(value: unknown): N8nEventEnvelope | null {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isBoundedString(value.eventId)
    || !isBoundedString(value.eventType)
    || !isAllowedEvent(value.eventType)
    || !isBoundedString(value.occurredAt)
    || !isBoundedString(value.entityId)
    || !isBoundedString(value.correlationId)
    || !isBoundedString(value.causationId)
    || !isRecord(value.resources)
    || !isRecord(value.data)) {
    return null;
  }

  try {
    if (new Date(value.occurredAt).toISOString() !== value.occurredAt) return null;
  } catch {
    return null;
  }

  const resourceKeys = ["contactId", "conversationId", "bookingId"] as const;
  if (Object.keys(value.resources).some(key => !resourceKeys.includes(key as typeof resourceKeys[number]))) {
    return null;
  }
  const resources: N8nEventEnvelope["resources"] = {};
  for (const key of resourceKeys) {
    const resource = value.resources[key];
    if (resource === undefined) continue;
    if (!isBoundedString(resource)) return null;
    resources[key] = resource;
  }

  const allowedDataKeys = ALLOWED_METADATA[value.eventType];
  if (Object.keys(value.data).some(key => !allowedDataKeys.includes(key))) return null;
  const data: N8nEventEnvelope["data"] = {};
  for (const [key, raw] of Object.entries(value.data)) {
    const sanitized = sanitizeScalar(raw);
    if (sanitized === undefined || sanitized !== raw) return null;
    data[key] = sanitized;
  }

  return {
    schemaVersion: 1,
    eventId: value.eventId,
    eventType: value.eventType,
    occurredAt: value.occurredAt,
    entityId: value.entityId,
    correlationId: value.correlationId,
    causationId: value.causationId,
    resources,
    data,
  };
}
