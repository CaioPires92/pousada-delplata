import { describe, expect, it } from "vitest";

import { buildN8nEventEnvelope, parseN8nEventEnvelope } from "./n8nEventContract";

describe("n8n CRM event contract", () => {
  it("builds a versioned envelope with only allowlisted metadata", () => {
    expect(buildN8nEventEnvelope({
      eventId: "event-1",
      occurredAt: "2026-08-05T18:30:00.000Z",
      event: {
        action: "MessageReceived",
        contactId: "contact-1",
        conversationId: "conversation-1",
        metadata: {
          channel: "whatsapp",
          messageType: "text",
          text: "conteúdo privado",
          phone: "5511999999999",
          apiKey: "secret",
        },
      },
    })).toEqual({
      schemaVersion: 1,
      eventId: "event-1",
      eventType: "MessageReceived",
      occurredAt: "2026-08-05T18:30:00.000Z",
      entityId: "conversation-1",
      correlationId: "conversation-1",
      causationId: "event-1",
      resources: { contactId: "contact-1", conversationId: "conversation-1" },
      data: { channel: "whatsapp", messageType: "text" },
    });
  });

  it("preserves explicit correlation and causation identifiers", () => {
    const envelope = buildN8nEventEnvelope({
      eventId: "event-child",
      occurredAt: "2026-08-05T18:30:00.000Z",
      event: {
        action: "PipelineStageChanged",
        conversationId: "conversation-1",
        correlationId: "journey-1",
        causationId: "event-parent",
      },
    });

    expect(envelope).toMatchObject({
      entityId: "conversation-1",
      correlationId: "journey-1",
      causationId: "event-parent",
    });
  });

  it("rejects events outside the external orchestration allowlist", () => {
    expect(buildN8nEventEnvelope({
      eventId: "event-2",
      occurredAt: new Date(),
      event: { action: "ContextualResponseDecision", metadata: { promptSummary: "private" } },
    })).toBeNull();
  });

  it("keeps quote business facts but drops arbitrary nested data", () => {
    const envelope = buildN8nEventEnvelope({
      eventId: "event-3",
      occurredAt: "2026-08-05T18:30:00.000Z",
      event: {
        action: "QuoteSent",
        metadata: {
          checkin: "2026-09-12",
          checkout: "2026-09-13",
          adults: 2,
          optionsCount: 3,
          rawResponse: { secret: true },
        },
      },
    });

    expect(envelope?.data).toEqual({
      checkin: "2026-09-12",
      checkout: "2026-09-13",
      adults: 2,
      optionsCount: 3,
    });
  });

  it("exposes payment and booking facts without provider payloads", () => {
    expect(buildN8nEventEnvelope({
      eventId: "event-payment",
      occurredAt: "2026-08-05T18:30:00.000Z",
      event: {
        action: "PaymentApproved",
        bookingId: "booking-1",
        conversationId: "conversation-1",
        metadata: {
          provider: "MERCADOPAGO",
          paymentStatus: "APPROVED",
          rawPayment: { token: "private" },
        },
      },
    })).toMatchObject({
      eventType: "PaymentApproved",
      resources: { bookingId: "booking-1", conversationId: "conversation-1" },
      data: { provider: "MERCADOPAGO", paymentStatus: "APPROVED" },
    });
  });

  it("accepts a canonical envelope after runtime validation", () => {
    const envelope = buildN8nEventEnvelope({
      eventId: "event-4",
      occurredAt: "2026-08-05T18:30:00.000Z",
      event: {
        action: "LeadCreated",
        conversationId: "conversation-1",
        metadata: { source: "whatsapp" },
      },
    });

    expect(parseN8nEventEnvelope(envelope)).toEqual(envelope);
  });

  it.each([
    { name: "unknown event", patch: { eventType: "DeleteDatabase" } },
    { name: "invalid timestamp", patch: { occurredAt: "today" } },
    { name: "unexpected resource", patch: { resources: { conversationId: "conversation-1", token: "secret" } } },
    { name: "unexpected data", patch: { data: { source: "whatsapp", messageText: "private" } } },
    { name: "nested data", patch: { data: { source: { raw: true } } } },
  ])("rejects $name at runtime", ({ patch }) => {
    const base = {
      schemaVersion: 1,
      eventId: "event-5",
      eventType: "LeadCreated",
      occurredAt: "2026-08-05T18:30:00.000Z",
      entityId: "conversation-1",
      correlationId: "conversation-1",
      causationId: "event-5",
      resources: { conversationId: "conversation-1" },
      data: { source: "whatsapp" },
    };

    expect(parseN8nEventEnvelope({ ...base, ...patch })).toBeNull();
  });
});
