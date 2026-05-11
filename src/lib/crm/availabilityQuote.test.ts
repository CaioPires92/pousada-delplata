import { describe, expect, it, vi } from "vitest";

import { queryAvailabilityQuote } from "./availabilityQuote";

function fakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    roomType: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    inventoryAdjustment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    fourGuestInventoryAdjustment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any;
}

function room(overrides: Record<string, unknown> = {}) {
  return {
    id: "room-1",
    name: "Apartamento Teste",
    basePrice: 200,
    totalUnits: 2,
    inventoryFor4Guests: 1,
    includedAdults: 2,
    maxGuests: 4,
    extraAdultFee: 80,
    child6To11Fee: 50,
    rates: [],
    ...overrides,
  };
}

describe("queryAvailabilityQuote", () => {
  it("returns sorted available options with booking price breakdown", async () => {
    const client = fakeClient();
    client.roomType.findMany.mockResolvedValue([
      room({ id: "room-expensive", name: "Mais caro", basePrice: 300 }),
      room({ id: "room-cheap", name: "Mais barato", basePrice: 200 }),
    ]);

    const result = await queryAvailabilityQuote({
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      childrenAges: [],
    }, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.nights).toBe(2);
    expect(result.options.map(option => option.roomTypeId)).toEqual(["room-cheap", "room-expensive"]);
    expect(result.options[0].totalPrice).toBe(400);
    expect(result.options[0].priceBreakdown.baseTotal).toBe(400);
  });

  it("excludes rooms with no remaining inventory during the requested range", async () => {
    const client = fakeClient();
    client.roomType.findMany.mockResolvedValue([room()]);
    client.inventoryAdjustment.findMany.mockResolvedValue([
      { dateKey: "2026-06-15", totalUnits: 0 },
    ]);

    const result = await queryAvailabilityQuote({
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      childrenAges: [],
    }, client);

    expect(result).toEqual({
      ok: true,
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      nights: 2,
      options: [],
    });
  });

  it("returns min stay error when all rooms require a longer stay", async () => {
    const client = fakeClient();
    client.roomType.findMany.mockResolvedValue([
      room({
        rates: [
          {
            startDate: new Date("2026-06-15T00:00:00.000Z"),
            endDate: new Date("2026-06-16T00:00:00.000Z"),
            price: 200,
            minLos: 3,
            stopSell: false,
            cta: false,
            ctd: false,
          },
        ],
      }),
    ]);

    const result = await queryAvailabilityQuote({
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 2,
      childrenAges: [],
    }, client);

    expect(result).toEqual({
      ok: false,
      error: "min_stay_required",
      minLos: 3,
    });
  });

  it("validates date range and guest count before querying inventory", async () => {
    const client = fakeClient();

    await expect(queryAvailabilityQuote({
      checkin: "2026-06-17",
      checkout: "2026-06-15",
      adults: 2,
      childrenAges: [],
    }, client)).resolves.toEqual({ ok: false, error: "invalid_date_range" });

    await expect(queryAvailabilityQuote({
      checkin: "2026-06-15",
      checkout: "2026-06-17",
      adults: 0,
      childrenAges: [],
    }, client)).resolves.toEqual({ ok: false, error: "invalid_guest_count" });

    expect(client.roomType.findMany).not.toHaveBeenCalled();
  });
});
