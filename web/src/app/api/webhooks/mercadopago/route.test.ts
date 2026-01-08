import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

// Mock Mercado Pago SDK
vi.mock('mercadopago', () => {
  const Payment = vi.fn();
  Payment.prototype.get = vi.fn();
  
  return {
    MercadoPagoConfig: vi.fn(),
    Payment: Payment,
  };
});

// Mock Email
vi.mock('@/lib/email', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      update: vi.fn(),
    },
  },
}));

describe('MercadoPago Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MP_ACCESS_TOKEN = 'test-token';
  });

  it('should process approved payment and confirm booking', async () => {
    // Setup MP mock response for this test
    const { Payment } = await import('mercadopago');
    (Payment.prototype.get as any).mockResolvedValue({
        id: 123456789,
        status: 'approved',
        external_reference: 'booking-123',
    });

    // Mock Booking Found
    const mockBooking = {
      id: 'booking-123',
      status: 'PENDING',
      payment: { id: 'payment-1' },
      guest: { name: 'John', email: 'john@example.com' },
      roomType: { name: 'Luxo' },
      totalPrice: 500,
      checkIn: new Date(),
      checkOut: new Date(),
    };

    (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

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
    
    // Verify DB updates
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-123' },
      data: { status: 'CONFIRMED' },
    });
    
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: expect.objectContaining({ status: 'APPROVED' }),
    });
  });

  it('should ignore non-payment notifications', async () => {
    const payload = { type: 'subscription', data: { id: '123' } };
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();
    
    expect(data.message).toContain('not handled');
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });
});
