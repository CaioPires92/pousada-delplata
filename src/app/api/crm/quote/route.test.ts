import { describe, expect, it, vi, beforeEach } from "vitest";

import prisma from "@/lib/prisma";
import { queryAvailabilityQuote } from "@/lib/crm/availabilityQuote";
import { recordCrmEvent } from "@/lib/crm/events";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  default: {
    conversation: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crm/availabilityQuote", () => ({
  queryAvailabilityQuote: vi.fn(),
}));

vi.mock("@/lib/crm/events", () => ({
  recordCrmEvent: vi.fn(),
}));

function quoteRequest(body: unknown) {
  return new Request("http://localhost/api/crm/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/crm/quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "conversation-1",
      contactId: "contact-1",
    } as any);
    vi.mocked(recordCrmEvent).mockResolvedValue(null as any);
  });

  it("returns a quote and records QuoteRequested", async () => {
    vi.mocked(queryAvailabilityQuote).mockResolvedValue({
      ok: true,
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      nights: 2,
      options: [
        {
          roomTypeId: "room-1",
          roomTypeName: "Apartamento",
          maxGuests: 4,
          remainingUnits: 2,
          minLos: 1,
          totalPrice: 400,
          priceBreakdown: {
            nights: 2,
            baseTotal: 400,
            adults: 2,
            childrenAges: [],
            effectiveAdults: 2,
            effectiveGuests: 2,
            includedAdults: 2,
            extraAdults: 0,
            extraAdultFee: 80,
            extraAdultTotal: 0,
            children6To11: 0,
            child6To11Fee: 50,
            childTotal: 0,
            total: 400,
          },
        },
      ],
    } as any);

    const response = await POST(quoteRequest({
      conversationId: "conversation-1",
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      children: 0,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.quote.options).toHaveLength(1);
    expect(queryAvailabilityQuote).toHaveBeenCalledWith({
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      childrenAges: [],
    });
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "QuoteRequested",
      contactId: "contact-1",
      conversationId: "conversation-1",
      metadata: expect.objectContaining({
        resultOk: true,
        optionsCount: 1,
      }),
    }));
  });

  it("returns 404 when the conversation does not exist", async () => {
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue(null);

    const response = await POST(quoteRequest({
      conversationId: "missing-conversation",
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      children: 0,
    }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, error: "conversation_not_found" });
    expect(queryAvailabilityQuote).not.toHaveBeenCalled();
  });

  it("returns structured min stay errors from the quote service", async () => {
    vi.mocked(queryAvailabilityQuote).mockResolvedValue({
      ok: false,
      error: "min_stay_required",
      minLos: 3,
    });

    const response = await POST(quoteRequest({
      conversationId: "conversation-1",
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      children: 0,
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "min_stay_required", minLos: 3 });
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "QuoteRequested",
      metadata: expect.objectContaining({
        resultOk: false,
        error: "min_stay_required",
      }),
    }));
  });

  it("validates required request fields", async () => {
    const response = await POST(quoteRequest({
      conversationId: "conversation-1",
      checkin: "2026-06-15",
      adults: 2,
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "invalid_body" });
    expect(prisma.conversation.findUnique).not.toHaveBeenCalled();
  });
});
