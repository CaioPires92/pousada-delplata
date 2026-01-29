import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

// Mock Email
vi.mock('@/lib/email', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    booking: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    payment: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('MercadoPago Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MP_ACCESS_TOKEN = 'test-token';
    delete process.env.MP_WEBHOOK_SECRET;
  });

  it('should process approved payment and confirm booking', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123456789,
        status: 'approved',
        external_reference: 'booking-123',
      }),
    } as any);

    // Mock Booking Found
    const mockBooking = {
      id: 'booking-123',
      status: 'PENDING',
      payment: { id: 'payment-1', status: 'PENDING', providerId: 'pref-123' },
      guest: { name: 'John', email: 'john@example.com' },
      roomType: { name: 'Luxo' },
      totalPrice: 500,
      checkIn: new Date(),
      checkOut: new Date(),
    };

    const tx = {
      booking: { findUnique: prisma.booking.findUnique, updateMany: prisma.booking.updateMany },
      payment: { updateMany: prisma.payment.updateMany, create: prisma.payment.create },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));

    (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);
    ;(prisma.booking.updateMany as any).mockResolvedValue({ count: 1 });
    ;(prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });

    // Mock Webhook Payload
    const payload = {
      type: 'payment',
      data: { id: '123456789' },
    };

    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.bookingStatus).toBe('CONFIRMED');
    expect(data.emailQueued).toBe(true);
    
    // Verify DB updates
    expect(prisma.booking.updateMany).toHaveBeenCalled();
    expect(prisma.payment.updateMany).toHaveBeenCalled();
  });

  it('should ignore non-payment notifications', async () => {
    const payload = { type: 'subscription', data: { id: '123' } };
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();
    
    expect(data.status).toBe('ignored');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
