import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1', email: 'admin@example.com', role: 'admin' })),
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('@/lib/expire-stale-bookings', () => ({
    expireBooking: vi.fn(),
}));

vi.mock('@/lib/mercadopago/payment-under-review', () => ({
    hasPaymentUnderReview: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { expireBooking } from '@/lib/expire-stale-bookings';
import { hasPaymentUnderReview } from '@/lib/mercadopago/payment-under-review';
import { POST } from './route';

function callExpire(bookingId = 'booking-1') {
    return POST(new Request('http://localhost/api/admin/bookings/booking-1/expire', { method: 'POST' }), {
        params: Promise.resolve({ bookingId }),
    });
}

describe('POST /api/admin/bookings/[bookingId]/expire', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'PENDING',
            payment: { status: 'PENDING' },
        });
        vi.mocked(hasPaymentUnderReview).mockResolvedValue(false);
        vi.mocked(expireBooking).mockResolvedValue({
            expired: true, couponReleased: true, guestEmailSent: true, adminAlertSent: true,
        });
    });

    it('expires pending booking', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/expire', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: ' booking-1 ' }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.bookingId).toBe('booking-1');
        expect(expireBooking).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'booking-1' }),
            expect.objectContaining({ expectedStatus: 'PENDING', sendGuestEmail: true, sendAdminAlert: true }),
        );
    });

    it('does not email the guest when expiring a non-pending booking', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'CONFIRMED',
            payment: { status: 'PENDING' },
        });

        await callExpire();

        expect(expireBooking).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ expectedStatus: 'CONFIRMED', sendGuestEmail: false }),
        );
    });

    it('blocks when a card payment is under review', async () => {
        vi.mocked(hasPaymentUnderReview).mockResolvedValue(true);

        const response = await callExpire();

        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe('BOOKING_HAS_PAYMENT_UNDER_REVIEW');
        expect(expireBooking).not.toHaveBeenCalled();
    });

    it('reports a status change detected during expiration', async () => {
        vi.mocked(expireBooking).mockResolvedValue({
            expired: false, couponReleased: false, guestEmailSent: false, adminAlertSent: false,
        });

        expect((await callExpire()).status).toBe(409);
    });

    it('blocks when payment is approved', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'CONFIRMED',
            payment: { status: 'APPROVED' },
        });

        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/expire', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        expect(response.status).toBe(409);
        expect(expireBooking).not.toHaveBeenCalled();
    });
});
