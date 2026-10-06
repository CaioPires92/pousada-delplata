import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET, POST } from "./route";
import { queryAvailabilityQuote } from "@/lib/availability/quote-service";

vi.mock("@/lib/availability/quote-service", () => ({
  queryAvailabilityQuote: vi.fn(),
}));

const mockedQueryAvailabilityQuote = vi.mocked(queryAvailabilityQuote);

const priceBreakdown = {
  nights: 2,
  baseTotal: 840,
  effectiveAdults: 2,
  childrenUnder12: 0,
  extraAdults: 0,
  children6To11: 0,
  extrasPerNight: 0,
  extraAdultTotal: 0,
  childTotal: 0,
  total: 840,
};

describe("/api/agents/quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an agent-friendly quote with booking links", async () => {
    mockedQueryAvailabilityQuote.mockResolvedValue({
      ok: true,
      checkin: "2026-10-10",
      checkout: "2026-10-12",
      nights: 2,
      quoteId: "quote_test",
      quoteVersion: 1,
      calculatedAt: "2026-10-05T12:00:00.000Z",
      expiresAt: "2026-10-05T12:15:00.000Z",
      quoteHash: "hash",
      options: [
        {
          roomTypeId: "room-1",
          roomTypeName: "Apartamento terreo triplo",
          maxGuests: 3,
          remainingUnits: 2,
          minLos: 1,
          totalPrice: 840,
          priceBreakdown,
        },
      ],
    });

    const response = await POST(new Request("https://www.pousadadelplata.com.br/api/agents/quote", {
      method: "POST",
      body: JSON.stringify({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        adults: 2,
        childrenAges: [],
      }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      ok: true,
      available: true,
      nights: 2,
      options: [
        {
          roomTypeName: "Apartamento terreo triplo",
          totalPrice: 840,
          currency: "BRL",
          dailyAverage: 420,
        },
      ],
    });
    expect(data.options[0].bookingUrl).toContain("/reservar?");
    expect(data.options[0].bookingUrl).toContain("roomTypeId=room-1");
    expect(mockedQueryAvailabilityQuote).toHaveBeenCalledWith({
      checkin: "2026-10-10",
      checkout: "2026-10-12",
      adults: 2,
      childrenAges: [],
      includeRoomDetails: false,
    });
  });

  it("accepts GET query params and room type filtering", async () => {
    mockedQueryAvailabilityQuote.mockResolvedValue({
      ok: true,
      checkin: "2026-10-10",
      checkout: "2026-10-12",
      nights: 2,
      quoteId: "quote_test",
      quoteVersion: 1,
      calculatedAt: "2026-10-05T12:00:00.000Z",
      expiresAt: "2026-10-05T12:15:00.000Z",
      quoteHash: "hash",
      options: [
        {
          roomTypeId: "room-1",
          roomTypeName: "Chale triplo",
          maxGuests: 3,
          remainingUnits: 1,
          minLos: 1,
          totalPrice: 700,
          priceBreakdown: { ...priceBreakdown, baseTotal: 700, total: 700 },
        },
        {
          roomTypeId: "room-2",
          roomTypeName: "Apartamento superior",
          maxGuests: 3,
          remainingUnits: 1,
          minLos: 1,
          totalPrice: 800,
          priceBreakdown: { ...priceBreakdown, baseTotal: 800, total: 800 },
        },
      ],
    });

    const response = await GET(new Request(
      "https://www.pousadadelplata.com.br/api/agents/quote?checkIn=2026-10-10&checkOut=2026-10-12&adults=2&childrenAges=6&roomType=chale"
    ));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.childrenAges).toEqual([6]);
    expect(data.options).toHaveLength(1);
    expect(data.options[0].roomTypeName).toBe("Chale triplo");
  });

  it("rejects missing or invalid dates before querying availability", async () => {
    const response = await POST(new Request("https://www.pousadadelplata.com.br/api/agents/quote", {
      method: "POST",
      body: JSON.stringify({ checkIn: "10/10/2026", checkOut: "", adults: 2 }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("invalid_or_missing_dates");
    expect(mockedQueryAvailabilityQuote).not.toHaveBeenCalled();
  });

  it("returns min stay errors in a readable shape", async () => {
    mockedQueryAvailabilityQuote.mockResolvedValue({
      ok: false,
      error: "min_stay_required",
      minLos: 3,
    });

    const response = await POST(new Request("https://www.pousadadelplata.com.br/api/agents/quote", {
      method: "POST",
      body: JSON.stringify({ checkIn: "2026-10-10", checkOut: "2026-10-12", adults: 2 }),
    }));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data).toMatchObject({
      ok: false,
      error: "min_stay_required",
      minLos: 3,
    });
  });
});
