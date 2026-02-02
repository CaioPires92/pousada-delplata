import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import prisma from '@/lib/prisma';

// Mock Prisma module
vi.mock('@/lib/prisma', () => ({
  default: {
    roomType: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

describe('Availability API - Pricing Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.booking.findMany as any).mockResolvedValue([]);
  });

  it('should return 400 if dates are missing', async () => {
    const req = new Request('http://localhost/api/availability');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBeDefined();
  });

  it('should apply custom rate correctly for specific dates', async () => {
    const checkIn = '2026-01-07'; // The "today" from bug report
    const checkOut = '2026-01-08';
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`);

    const mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      basePrice: 100, // Should NOT be used
      capacity: 4,
      totalUnits: 5,
      amenities: '',
      photos: [],
      inventory: [],
      rates: [
        {
          startDate: '2026-01-07',
          endDate: '2026-01-07',
          price: 200, // Custom Price
          stopSell: false,
          cta: false,
          ctd: false,
          minLos: 1
        }
      ]
    };

    (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].totalPrice).toBe(200); // Should match custom rate, not basePrice (100)
    expect(data[0].priceBreakdown).toBeDefined();
    expect(data[0].priceBreakdown.baseTotal).toBe(200);
  });

  it('should fallback to basePrice when no rate exists', async () => {
    const checkIn = '2026-02-01';
    const checkOut = '2026-02-02';
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`);

    const mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      basePrice: 100, // Should BE used
      capacity: 4,
      totalUnits: 5,
      amenities: '',
      photos: [],
      inventory: [],
      rates: [] // No rates
    };

    (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const res = await GET(req);
    const data = await res.json();

    expect(data[0].totalPrice).toBe(100);
    expect(data[0].priceBreakdown.baseTotal).toBe(100);
  });

  it('should add extra adult fee per night for 3rd adult', async () => {
    const checkIn = '2026-02-01';
    const checkOut = '2026-02-03';
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=3&children=0`);

    const mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      basePrice: 100,
      capacity: 4,
      maxGuests: 3,
      includedAdults: 2,
      extraAdultFee: 50,
      child6To11Fee: 30,
      totalUnits: 5,
      amenities: '',
      photos: [],
      inventory: [],
      rates: []
    };

    (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[0].priceBreakdown.extraAdults).toBe(1);
    expect(data[0].priceBreakdown.extraAdultTotal).toBe(100);
    expect(data[0].totalPrice).toBe(300);
  });

  it('should add child 6-11 fee per night', async () => {
    const checkIn = '2026-02-01';
    const checkOut = '2026-02-02';
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=1&childrenAges=8`);

    const mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      basePrice: 100,
      capacity: 4,
      maxGuests: 3,
      includedAdults: 2,
      extraAdultFee: 50,
      child6To11Fee: 30,
      totalUnits: 5,
      amenities: '',
      photos: [],
      inventory: [],
      rates: []
    };

    (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[0].priceBreakdown.children6To11).toBe(1);
    expect(data[0].priceBreakdown.childTotal).toBe(30);
    expect(data[0].totalPrice).toBe(130);
  });

  // NEW TESTS FROM PLAN

  it('should not charge for child under 6 years old', async () => {
    const checkIn = '2026-02-01';
    const checkOut = '2026-02-02';
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=2&childrenAges=3,5`);

    const mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      basePrice: 100,
      capacity: 4,
      maxGuests: 4,
      includedAdults: 2,
      extraAdultFee: 50,
      child6To11Fee: 30,
      totalUnits: 5,
      amenities: '',
      photos: [],
      inventory: [],
      rates: []
    };

    (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[0].priceBreakdown.children6To11).toBe(0); // No children in 6-11 range
    expect(data[0].priceBreakdown.childTotal).toBe(0); // No child fees
    expect(data[0].totalPrice).toBe(100); // Only base price
  });

  it('should calculate total correctly with mixed children ages', async () => {
    const checkIn = '2026-02-01';
    const checkOut = '2026-02-03'; // 2 nights
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=3&childrenAges=4,8,13`);

    const mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      basePrice: 200, // Per night - API loop will sum 200+200=400 for stays
      capacity: 5,
      maxGuests: 5,
      includedAdults: 2,
      extraAdultFee: 100,
      child6To11Fee: 80,
      totalUnits: 5,
      amenities: '',
      photos: [],
      inventory: [],
      rates: []
    };

    (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Age 13 converts to adult (3 total adults), age 8 is 6-11, age 4 is free
    expect(data[0].priceBreakdown.effectiveAdults).toBe(3); // 2 + 1 from age 13
    expect(data[0].priceBreakdown.children6To11).toBe(1); // Only age 8
    expect(data[0].priceBreakdown.extraAdults).toBe(1); // 3 - 2 included
    expect(data[0].priceBreakdown.extraAdultTotal).toBe(200); // 100 * 2 nights
    expect(data[0].priceBreakdown.childTotal).toBe(160); // 80 * 2 nights
    expect(data[0].totalPrice).toBe(760); // 400 base (200*2) + 200 adult + 160 child
  });

  it('should count child age 12 as adult in pricing', async () => {
    const checkIn = '2026-02-01';
    const checkOut = '2026-02-02';
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=1&childrenAges=12`);

    const mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      basePrice: 100,
      capacity: 4,
      maxGuests: 3,
      includedAdults: 2,
      extraAdultFee: 100,
      child6To11Fee: 30,
      totalUnits: 5,
      amenities: '',
      photos: [],
      inventory: [],
      rates: []
    };

    (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
    (prisma.$queryRaw as any).mockResolvedValue([]);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data[0].priceBreakdown.effectiveAdults).toBe(3); // 2 adults + 1 from age 12
    expect(data[0].priceBreakdown.children6To11).toBe(0); // Age 12 is NOT in 6-11
    expect(data[0].priceBreakdown.extraAdults).toBe(1);
    expect(data[0].priceBreakdown.extraAdultTotal).toBe(100);
    expect(data[0].totalPrice).toBe(200); // 100 base + 100 extra adult
  });

  it('should return 400 for invalid date range (checkIn equals checkOut)', async () => {
    const checkIn = '2026-02-01';
    const checkOut = '2026-02-01'; // Same day = 0 nights
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`);

    const res = await GET(req);

    // API should validate and return 400 for 0 nights
    expect(res.status).toBe(400);
  });
});
