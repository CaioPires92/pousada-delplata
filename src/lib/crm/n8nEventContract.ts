import type { CrmEventInput } from "@/lib/crm/events";

export const N8N_EVENT_ALLOWLIST = [
  "LeadCreated",
  "MessageReceived",
  "AutomationHandoffRequested",
  "WhatsAppSendFailed",
  "WebhookProcessingFailed",
  "QuoteSent",
  "ReservationStarted",
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
  PipelineStageChanged: ["fromStage", "toStage", "actorType"],
  PostStayIssueDetected: ["source"],
  HumanTookOver: ["pauseStrategy", "pauseMinutes"],
  AutomationPaused: ["pauseStrategy", "pauseMinutes"],
};

function isAllowedEvent(action: string): action is N8nAllowedEvent {
  return (N8N_EVENT_ALLOWLIST as readonly string[]).includes(action);
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
