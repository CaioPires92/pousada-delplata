import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';
import { hashCouponCode } from '@/lib/coupons/hash';

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
    fourGuestInventoryAdjustment: {
      findMany: vi.fn(),
    },
    guest: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    couponRedemption: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('Bookings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.booking.findMany as any).mockResolvedValue([]);
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
    (prisma.fourGuestInventoryAdjustment.findMany as any).mockResolvedValue([]);
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
      subtotalPrice: 400,
      discountAmount: 0,
      appliedCouponCode: null,
      totalPrice: 400,
      status: 'PENDING',
    };

    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      fourGuestInventoryAdjustment: { findMany: prisma.fourGuestInventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create, findFirst: prisma.guest.findFirst, update: prisma.guest.update },
      couponRedemption: { findUnique: prisma.couponRedemption.findUnique, updateMany: prisma.couponRedemption.updateMany },
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
    (prisma.booking.findMany as any).mockResolvedValue([]);
    (prisma.guest.findFirst as any).mockResolvedValue(null);
    (prisma.guest.create as any).mockResolvedValue(mockGuest);
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
    expect(prisma.guest.create).toHaveBeenCalledWith({
      data: {
        name: body.guest.name,
        email: body.guest.email,
        phone: body.guest.phone,
      },
    });
    expect(prisma.booking.create).toHaveBeenCalled();
  });

  it('should apply reserved coupon and create discounted booking', async () => {
    const mockGuest = {
      id: 'guest-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123456789',
    };

    const mockBooking = {
      id: 'booking-2',
      roomTypeId: 'room-1',
      guestId: 'guest-1',
      checkIn: new Date('2026-01-01'),
      checkOut: new Date('2026-01-05'),
      subtotalPrice: 400,
      discountAmount: 50,
      appliedCouponCode: 'VIP10',
      totalPrice: 350,
      status: 'PENDING',
    };

    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      fourGuestInventoryAdjustment: { findMany: prisma.fourGuestInventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create, findFirst: prisma.guest.findFirst, update: prisma.guest.update },
      couponRedemption: { findUnique: prisma.couponRedemption.findUnique, updateMany: prisma.couponRedemption.updateMany },
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
    (prisma.booking.findMany as any).mockResolvedValue([]);
    (prisma.guest.findFirst as any).mockResolvedValue(null);
    (prisma.guest.create as any).mockResolvedValue(mockGuest);
    (prisma.couponRedemption.findUnique as any).mockResolvedValue({
      id: 'res-1',
      status: 'RESERVED',
      bookingId: null,
      guestEmail: 'john@example.com',
      discountAmount: 50,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      coupon: {
        codeHash: hashCouponCode('VIP10'),
      },
    });
    (prisma.booking.create as any).mockResolvedValue(mockBooking);
    (prisma.couponRedemption.updateMany as any).mockResolvedValue({ count: 1 });

    const body = {
      roomTypeId: 'room-1',
      checkIn: '2026-01-01',
      checkOut: '2026-01-05',
      adults: 2,
      childrenAges: [],
      guest: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123456789',
      },
      coupon: {
        reservationId: 'res-1',
        code: 'VIP10',
      },
    };

    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.totalPrice).toBe(350);
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalPrice: 400,
          discountAmount: 50,
          totalPrice: 350,
          appliedCouponCode: 'VIP10',
        }),
      })
    );
    expect(prisma.couponRedemption.updateMany).toHaveBeenCalled();
  });

  it('should return 400 if coupon reservation is expired', async () => {
    const mockGuest = {
      id: 'guest-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123456789',
    };

    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      fourGuestInventoryAdjustment: { findMany: prisma.fourGuestInventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create, findFirst: prisma.guest.findFirst, update: prisma.guest.update },
      couponRedemption: { findUnique: prisma.couponRedemption.findUnique, updateMany: prisma.couponRedemption.updateMany },
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
    (prisma.guest.findFirst as any).mockResolvedValue(null);
    (prisma.guest.create as any).mockResolvedValue(mockGuest);
    (prisma.couponRedemption.findUnique as any).mockResolvedValue({
      id: 'res-1',
      status: 'RESERVED',
      bookingId: null,
      guestEmail: 'john@example.com',
      discountAmount: 50,
      expiresAt: new Date('2000-01-01T00:00:00.000Z'),
      coupon: { codeHash: 'hash' },
    });
    (prisma.booking.findMany as any).mockResolvedValue([]);

    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        roomTypeId: 'room-1',
        checkIn: '2026-01-01',
        checkOut: '2026-01-05',
        adults: 2,
        childrenAges: [],
        guest: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123456789',
        },
        coupon: {
          reservationId: 'res-1',
          code: 'VIP10',
        },
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('coupon_reservation_expired');
  });

  it('should return 400 if fields are missing', async () => {
    const body = {
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

  it('should return 409 when 4-guest inventory is exhausted', async () => {
    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      fourGuestInventoryAdjustment: { findMany: prisma.fourGuestInventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create, findFirst: prisma.guest.findFirst, update: prisma.guest.update },
      couponRedemption: { findUnique: prisma.couponRedemption.findUnique, updateMany: prisma.couponRedemption.updateMany },
      $queryRaw: prisma.$queryRaw,
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.roomType.findUnique as any).mockResolvedValue({
      id: 'room-1',
      totalUnits: 6,
      inventoryFor4Guests: 2,
      basePrice: 100,
      maxGuests: 4,
      includedAdults: 2,
      extraAdultFee: 100,
      child6To11Fee: 30,
      rates: [],
    });
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
    (prisma.booking.findMany as any).mockResolvedValue([
      {
        checkIn: new Date('2026-01-01T00:00:00.000Z'),
        checkOut: new Date('2026-01-05T00:00:00.000Z'),
        adults: 4,
        childrenAges: null,
      },
      {
        checkIn: new Date('2026-01-01T00:00:00.000Z'),
        checkOut: new Date('2026-01-05T00:00:00.000Z'),
        adults: 2,
        childrenAges: JSON.stringify([4, 7]),
      },
    ]);

    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        roomTypeId: 'room-1',
        checkIn: '2026-01-01',
        checkOut: '2026-01-05',
        adults: 4,
        children: 0,
        childrenAges: [],
        guest: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123456789',
        },
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe('room_unavailable');
  });

  it('should return 409 when a manual quadruplo adjustment is consumed by an active booking', async () => {
    const tx = {
      roomType: { findUnique: prisma.roomType.findUnique },
      inventoryAdjustment: { findMany: prisma.inventoryAdjustment.findMany },
      fourGuestInventoryAdjustment: { findMany: prisma.fourGuestInventoryAdjustment.findMany },
      booking: { findMany: prisma.booking.findMany, create: prisma.booking.create },
      guest: { create: prisma.guest.create, findFirst: prisma.guest.findFirst, update: prisma.guest.update },
      couponRedemption: { findUnique: prisma.couponRedemption.findUnique, updateMany: prisma.couponRedemption.updateMany },
      $queryRaw: prisma.$queryRaw,
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.roomType.findUnique as any).mockResolvedValue({
      id: 'room-1',
      totalUnits: 6,
      inventoryFor4Guests: 2,
      basePrice: 100,
      maxGuests: 4,
      includedAdults: 2,
      extraAdultFee: 100,
      child6To11Fee: 30,
      rates: [],
    });
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
    (prisma.fourGuestInventoryAdjustment.findMany as any).mockResolvedValue([
      { dateKey: '2026-01-01', totalUnits: 1 },
      { dateKey: '2026-01-02', totalUnits: 1 },
      { dateKey: '2026-01-03', totalUnits: 1 },
      { dateKey: '2026-01-04', totalUnits: 1 },
    ]);
    (prisma.booking.findMany as any).mockResolvedValue([
      {
        checkIn: new Date('2026-01-01T00:00:00.000Z'),
        checkOut: new Date('2026-01-05T00:00:00.000Z'),
        adults: 4,
        childrenAges: null,
      },
    ]);

    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        roomTypeId: 'room-1',
        checkIn: '2026-01-01',
        checkOut: '2026-01-05',
        adults: 4,
        children: 0,
        childrenAges: [],
        guest: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123456789',
        },
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe('room_unavailable');
  });
});

