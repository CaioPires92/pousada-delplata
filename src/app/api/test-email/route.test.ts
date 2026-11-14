// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({ requireAdminAuth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
    default: { booking: { findUnique: vi.fn() } },
}));
vi.mock('@/lib/email', () => ({ sendBookingConfirmationEmail: vi.fn() }));

import { requireAdminAuth } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { POST } from './route';

const booking = {
    id: 'booking-1',
    guest: { name: 'Guest', email: 'persisted@example.com' },
    roomType: { name: 'Room' },
    payment: null,
    checkIn: new Date('2026-12-01T00:00:00Z'),
    checkOut: new Date('2026-12-02T00:00:00Z'),
    totalPrice: 500,
    adults: 2,
    children: 0,
    childrenAges: null,
};

function request(body: Record<string, unknown>) {
    return new Request('http://localhost/api/test-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.31' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/test-email', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('NODE_ENV', 'test');
        (requireAdminAuth as any).mockResolvedValue({ adminId: 'admin-1' });
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        (sendBookingConfirmationEmail as any).mockResolvedValue({ success: true, messageId: 'smtp-id' });
    });

    it('requires administrative authorization', async () => {
        (requireAdminAuth as any).mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));

        const response = await POST(request({ bookingId: 'booking-1' }));

        expect(response.status).toBe(401);
        expect(prisma.booking.findUnique).not.toHaveBeenCalled();
        expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
    });

    it('uses the persisted recipient and does not expose it in the response', async () => {
        const response = await POST(request({ bookingId: 'booking-1' }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ success: true });
        expect(sendBookingConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({
            bookingId: 'booking-1',
            guestEmail: 'persisted@example.com',
        }));
        expect(JSON.stringify(data)).not.toContain('persisted@example.com');
        expect(JSON.stringify(data)).not.toContain('smtp-id');
    });

    it('rejects attempts to override email content or recipient', async () => {
        const response = await POST(request({
            bookingId: 'booking-1',
            email: 'attacker@example.net',
        }));

        expect(response.status).toBe(400);
        expect(prisma.booking.findUnique).not.toHaveBeenCalled();
        expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
    });
});
