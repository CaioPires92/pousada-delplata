import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    booking: {
      findUnique: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
  },
}));

// Mock Fetch Globalmente
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MercadoPago Create Preference API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup Env Vars
    process.env.MP_ACCESS_TOKEN = 'test-token';
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY = 'test-public-key';
  });

  it('should create a preference successfully', async () => {
    const mockBooking = {
      id: 'booking-1',
      checkIn: new Date('2026-01-01'),
      checkOut: new Date('2026-01-05'),
      totalPrice: 500,
      guest: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '11999999999',
      },
      roomType: {
        id: 'room-1',
        name: 'Luxo',
      },
    };

    const mockMPResponse = {
      id: 'pref-123',
      init_point: 'https://mp.com/checkout',
      sandbox_init_point: 'https://sandbox.mp.com/checkout',
    };

    (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockMPResponse,
    });

    const req = new Request('http://localhost/api/mercadopago/create-preference', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.preferenceId).toBe('pref-123');
    expect(data.initPoint).toBe('https://mp.com/checkout');

    // Verify Prisma payment creation
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'booking-1',
        amount: 500,
        providerId: 'pref-123',
      }),
    });
  });

  it('should return 404 if booking not found', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(null);

    const req = new Request('http://localhost/api/mercadopago/create-preference', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'non-existent' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('should handle MP API errors', async () => {
    const mockBooking = {
      id: 'booking-1',
      checkIn: new Date(),
      checkOut: new Date(),
      totalPrice: 100,
      guest: { phone: '11999999999', name: 'John', email: 'j@d.com' },
      roomType: { id: 'r1', name: 'Room' }
    };

    (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'Invalid item' }),
    });

    const req = new Request('http://localhost/api/mercadopago/create-preference', {
      method: 'POST',
      body: JSON.stringify({ bookingId: 'booking-1' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Failed to create');
  });
});
