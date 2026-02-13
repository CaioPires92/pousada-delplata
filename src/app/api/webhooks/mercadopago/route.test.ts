import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

// Mock Email
vi.mock('@/lib/email', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendBookingCreatedAlertEmail: vi.fn().mockResolvedValue({ success: true }),
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
    ; (prisma.booking.updateMany as any).mockResolvedValue({ count: 1 });
    ; (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });

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

  it('should reject invalid signature when secret is set', async () => {
    process.env.MP_WEBHOOK_SECRET = 'secret';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'pending', external_reference: 'booking-123' }),
    } as any);
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      headers: {
        'x-signature': 'ts=1,v1=bad',
        'x-request-id': 'req-1',
      },
      body: JSON.stringify({ type: 'payment', data: { id: '123' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should reject when signature headers are missing and secret is set', async () => {
    process.env.MP_WEBHOOK_SECRET = 'secret';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'pending', external_reference: 'booking-123' }),
    } as any);
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment', data: { id: '123' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should map rejected status to CANCELLED/REJECTED', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 987654321,
        status: 'rejected',
        external_reference: 'booking-xyz',
      }),
    } as any);
    const tx = {
      booking: { findUnique: prisma.booking.findUnique, updateMany: prisma.booking.updateMany },
      payment: { updateMany: prisma.payment.updateMany, create: prisma.payment.create },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 'booking-xyz',
      status: 'PENDING',
      payment: { id: 'payment-1', status: 'PENDING', providerId: null },
      guest: { name: 'A', email: 'a@b.com' },
      roomType: { name: 'R' },
      totalPrice: 100,
      checkIn: new Date(),
      checkOut: new Date(),
    });
    ; (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment', data: { id: '987654321' } }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.bookingStatus).toBe('CANCELLED');
    expect(data.paymentStatus).toBe('REJECTED');
  });

  it('should map refunded status to CANCELLED/REFUNDED', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 222333444,
        status: 'refunded',
        external_reference: 'booking-ref',
      }),
    } as any);
    const tx = {
      booking: { findUnique: prisma.booking.findUnique, updateMany: prisma.booking.updateMany },
      payment: { updateMany: prisma.payment.updateMany, create: prisma.payment.create },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 'booking-ref',
      status: 'PENDING',
      payment: { id: 'payment-1', status: 'PENDING', providerId: null },
      guest: { name: 'B', email: 'b@c.com' },
      roomType: { name: 'R' },
      totalPrice: 200,
      checkIn: new Date(),
      checkOut: new Date(),
    });
    ; (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment', data: { id: '222333444' } }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.bookingStatus).toBe('CANCELLED');
    expect(data.paymentStatus).toBe('REFUNDED');
  });
  it('should return 404 when booking not found', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, status: 'approved', external_reference: 'missing' }),
    } as any);
    const tx = {
      booking: { findUnique: prisma.booking.findUnique, updateMany: prisma.booking.updateMany },
      payment: { updateMany: prisma.payment.updateMany, create: prisma.payment.create },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));
    (prisma.booking.findUnique as any).mockResolvedValue(null);
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment', data: { id: '1' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('should return 500 when MP access token missing', async () => {
    delete process.env.MP_ACCESS_TOKEN;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, status: 'approved', external_reference: 'booking-1' }),
    } as any);
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment', data: { id: '1' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
