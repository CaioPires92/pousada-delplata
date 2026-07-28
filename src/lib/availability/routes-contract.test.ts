import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { GET as getPublicAvailability } from "@/app/api/availability/route";
import { POST as postCrmQuote } from "@/app/api/crm/quote/route";

vi.mock("@/lib/prisma", () => ({
  default: {
    roomType: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    inventoryAdjustment: {
      findMany: vi.fn(),
    },
    fourGuestInventoryAdjustment: {
      findMany: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crm/events", () => ({
  recordCrmEvent: vi.fn(),
}));

const CRM_TOKEN = "contract-test-token";

function crmRequest(input: {
  checkin: string;
  checkout: string;
  adults: number;
  children?: number;
  childrenAges?: number[];
}) {
  return new Request("http://localhost/api/crm/quote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRM_TOKEN}`,
    },
    body: JSON.stringify({
      conversationId: "conversation-contract",
      children: 0,
      ...input,
    }),
  });
}

describe("availability contract between public site and CRM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = CRM_TOKEN;
    vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
    vi.mocked(prisma.inventoryAdjustment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.fourGuestInventoryAdjustment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conversation.findUnique).mockResolvedValue({
      id: "conversation-contract",
      contactId: "contact-contract",
    } as never);
    vi.mocked(recordCrmEvent).mockResolvedValue(null as never);
  });

  it("returns identical rooms, totals, inventory and restrictions for the same input", async () => {
    vi.mocked(prisma.roomType.findMany).mockResolvedValue([
      {
        id: "room-contract",
        name: "Apartamento Contrato",
        basePrice: 200,
        totalUnits: 3,
        inventoryFor4Guests: 1,
        includedAdults: 2,
        maxGuests: 4,
        extraAdultFee: 80,
        child6To11Fee: 50,
        photos: [{ id: "photo-1", url: "/room.jpg", position: 0 }],
        rates: [{
          startDate: new Date("2026-08-10T00:00:00.000Z"),
          endDate: new Date("2026-08-11T00:00:00.000Z"),
          price: 250,
          minLos: 2,
          stopSell: false,
          cta: false,
          ctd: false,
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        }],
      },
    ] as never);
    vi.mocked(prisma.booking.findMany).mockResolvedValue([{
      checkIn: new Date("2026-08-10T00:00:00.000Z"),
      checkOut: new Date("2026-08-12T00:00:00.000Z"),
      adults: 2,
      childrenAges: null,
    }] as never);

    const publicResponse = await getPublicAvailability(new Request(
      "http://localhost/api/availability?checkIn=2026-08-10&checkOut=2026-08-12&adults=2"
    ));
    const crmResponse = await postCrmQuote(crmRequest({
      checkin: "2026-08-10",
      checkout: "2026-08-12",
      adults: 2,
    }));
    const publicBody = await publicResponse.json();
    const crmBody = await crmResponse.json();

    expect(publicResponse.status).toBe(200);
    expect(crmResponse.status).toBe(200);
    expect(publicBody.map((room: Record<string, unknown>) => ({
      roomTypeId: room.id,
      totalPrice: room.totalPrice,
      remainingUnits: room.remainingUnits,
      minLos: room.minLos,
      priceBreakdown: room.priceBreakdown,
    }))).toEqual(crmBody.quote.options.map((option: Record<string, unknown>) => ({
      roomTypeId: option.roomTypeId,
      totalPrice: option.totalPrice,
      remainingUnits: option.remainingUnits,
      minLos: option.minLos,
      priceBreakdown: option.priceBreakdown,
    })));
  });

  it("returns the same minimum-stay restriction through both contracts", async () => {
    vi.mocked(prisma.roomType.findMany).mockResolvedValue([
      {
        id: "room-min-los-contract",
        name: "Apartamento MinLos",
        basePrice: 200,
        totalUnits: 2,
        inventoryFor4Guests: 1,
        includedAdults: 2,
        maxGuests: 4,
        extraAdultFee: 80,
        child6To11Fee: 50,
        photos: [],
        rates: [{
          startDate: new Date("2026-08-10T00:00:00.000Z"),
          endDate: new Date("2026-08-10T00:00:00.000Z"),
          price: 250,
          minLos: 3,
          stopSell: false,
          cta: false,
          ctd: false,
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        }],
      },
    ] as never);

    const publicResponse = await getPublicAvailability(new Request(
      "http://localhost/api/availability?checkIn=2026-08-10&checkOut=2026-08-11&adults=2"
    ));
    const crmResponse = await postCrmQuote(crmRequest({
      checkin: "2026-08-10",
      checkout: "2026-08-11",
      adults: 2,
    }));
    const publicBody = await publicResponse.json();
    const crmBody = await crmResponse.json();

    expect(publicResponse.status).toBe(400);
    expect(crmResponse.status).toBe(400);
    expect(publicBody).toEqual({ error: "min_stay_required", minLos: 3 });
    expect(crmBody).toEqual({ ok: false, error: "min_stay_required", minLos: 3 });
  });
});
