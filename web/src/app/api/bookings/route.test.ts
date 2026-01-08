import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    guest: {
      create: vi.fn(),
    },
    booking: {
      create: vi.fn(),
    },
  },
}));

describe('Bookings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      totalPrice: 1000,
      status: 'PENDING',
    };

    (prisma.guest.create as any).mockResolvedValue(mockGuest);
    (prisma.booking.create as any).mockResolvedValue(mockBooking);

    const body = {
      roomTypeId: 'room-1',
      checkIn: '2026-01-01',
      checkOut: '2026-01-05',
      guest: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123456789',
      },
      totalPrice: 1000,
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
    expect(data.error).toBe('Missing required fields');
  });
});
