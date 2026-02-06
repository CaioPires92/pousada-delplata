import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    roomType: {
      findUnique: vi.fn(),
    },
    inventoryAdjustment: {
      findMany: vi.fn(),
    },
    guest: {
      create: vi.fn(),
      upsert: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Bookings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 500 when inventory reports zero units (No availability)', async () => {
    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create, upsert: prisma.guest.upsert },
      $queryRaw: prisma.$queryRaw,
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.roomType.findUnique as any).mockResolvedValue({
      id: 'room-1',
      totalUnits: 1,
      basePrice: 100,
      maxGuests: 3,
      includedAdults: 2,
      extraAdultFee: 50,
      child6To11Fee: 30,
      rates: [],
    });
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([
      { roomTypeId: 'room-1', date: new Date('2026-01-01T00:00:00Z'), totalUnits: 0 },
    ]);
    (prisma.$queryRaw as any).mockResolvedValue([]);
    const body = {
      roomTypeId: 'room-1',
      checkIn: '2026-01-01',
      checkOut: '2026-01-02',
      adults: 2,
      children: 0,
      childrenAges: [],
      guest: { name: 'John', email: 'john@example.com', phone: '1' },
    };
    const req = new Request('http://localhost/api/bookings', { method: 'POST', body: JSON.stringify(body) });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('Erro ao criar reserva');
  });

  it('should return 500 when overlapping bookings consume all inventory', async () => {
    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create, upsert: prisma.guest.upsert },
      $queryRaw: prisma.$queryRaw,
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.roomType.findUnique as any).mockResolvedValue({
      id: 'room-1',
      totalUnits: 1,
      basePrice: 100,
      maxGuests: 3,
      includedAdults: 2,
      extraAdultFee: 50,
      child6To11Fee: 30,
      rates: [],
    });
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
    (prisma.$queryRaw as any).mockResolvedValue([
      { checkInDay: '2026-01-01', checkOutDay: '2026-01-03' }, // ocupa 01 e 02
    ]);
    const body = {
      roomTypeId: 'room-1',
      checkIn: '2026-01-01',
      checkOut: '2026-01-03',
      adults: 2,
      children: 0,
      childrenAges: [],
      guest: { name: 'John', email: 'john@example.com', phone: '1' },
    };
    const req = new Request('http://localhost/api/bookings', { method: 'POST', body: JSON.stringify(body) });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('Erro ao criar reserva');
  });

  it('blocks when there is PENDING within TTL overlap', async () => {
    (process.env as any).PENDING_BOOKING_TTL_MINUTES = '30';
    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create, upsert: prisma.guest.upsert },
      $queryRaw: prisma.$queryRaw,
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.roomType.findUnique as any).mockResolvedValue({
      id: 'room-1',
      totalUnits: 1,
      basePrice: 100,
      maxGuests: 3,
      includedAdults: 2,
      extraAdultFee: 50,
      child6To11Fee: 30,
      rates: [],
    });
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
    (prisma.$queryRaw as any).mockResolvedValue([
      { checkInDay: '2026-01-01', checkOutDay: '2026-01-03' },
    ]);
    const body = {
      roomTypeId: 'room-1',
      checkIn: '2026-01-01',
      checkOut: '2026-01-03',
      adults: 2,
      children: 0,
      childrenAges: [],
      guest: { name: 'John', email: 'john@example.com', phone: '1' },
    };
    const req = new Request('http://localhost/api/bookings', { method: 'POST', body: JSON.stringify(body) });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('Erro ao criar reserva');
  });
  it('should create a booking and guest successfully', async () => {
    const mockGuest = {
      id: 'guest-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123456789',
    };

    const mockBooking = {
      id: 'booking-1',
      roomTypeId: 'room-1',
      guestId: 'guest-1',
      checkIn: new Date('2026-01-01'),
      checkOut: new Date('2026-01-05'),
      totalPrice: 400,
      status: 'PENDING',
    };

    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create },
      $queryRaw: prisma.$queryRaw,
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.roomType.findUnique as any).mockResolvedValue({
      id: 'room-1',
      totalUnits: 1,
      basePrice: 100,
      maxGuests: 3,
      includedAdults: 2,
      extraAdultFee: 50,
      child6To11Fee: 30,
      rates: [],
    });
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
    (prisma.$queryRaw as any).mockResolvedValue([]);
    (prisma.guest.upsert as any).mockResolvedValue(mockGuest);
    (prisma.booking.create as any).mockResolvedValue(mockBooking);

    const body = {
      roomTypeId: 'room-1',
      checkIn: '2026-01-01',
      checkOut: '2026-01-05',
      adults: 2,
      children: 0,
      childrenAges: [],
      guest: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123456789',
      },
      totalPrice: 9999,
    };

    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({
      ...mockBooking,
      checkIn: mockBooking.checkIn.toISOString(),
      checkOut: mockBooking.checkOut.toISOString(),
    });
    expect(prisma.guest.upsert).toHaveBeenCalled();
    expect(prisma.booking.create).toHaveBeenCalled();
  });

  it('should return 400 if fields are missing', async () => {
    const body = {
      // Missing roomTypeId and guest
      checkIn: '2026-01-01',
    };

    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
  expect(data.error).toBe('Campos obrigatórios ausentes');
  });
});
