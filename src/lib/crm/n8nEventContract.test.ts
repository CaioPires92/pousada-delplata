import { describe, expect, it } from "vitest";

import { buildN8nEventEnvelope } from "./n8nEventContract";

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
});
