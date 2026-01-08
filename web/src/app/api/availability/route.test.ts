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
        count: vi.fn()
    }
  },
}));

describe('Availability API - Pricing Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2`);

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
          startDate: new Date('2026-01-07T00:00:00Z'), // UTC Midnight
          endDate: new Date('2026-01-07T23:59:59Z'),
          price: 200, // Custom Price
          stopSell: false,
          cta: false,
          ctd: false,
          minLos: 1
        }
      ]
    };

    (prisma.roomType.findMany as any).mockResolvedValue([mockRoom]);
    (prisma.booking.count as any).mockResolvedValue(0);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].totalPrice).toBe(200); // Should match custom rate, not basePrice (100)
  });

  it('should fallback to basePrice when no rate exists', async () => {
    const checkIn = '2026-02-01'; 
    const checkOut = '2026-02-02';
    const req = new Request(`http://localhost/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2`);

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
    (prisma.booking.count as any).mockResolvedValue(0);

    const res = await GET(req);
    const data = await res.json();

    expect(data[0].totalPrice).toBe(100);
  });
});
