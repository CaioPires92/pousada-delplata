import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import prisma from '@/lib/prisma';
import { sendBookingExpiredEmail } from '@/lib/email';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';

vi.mock('@/lib/email', () => ({
    sendBookingConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendBookingCreatedAlertEmail: vi.fn().mockResolvedValue({ success: true }),
    sendBookingExpiredEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/booking-status-alert', () => ({
    sendBookingStatusAlertEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findMany: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        couponRedemption: {
            updateMany: vi.fn(),
        },
    },
}));

describe('GET /api/cron/cleanup-bookings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('CRON_SECRET', 'secret');
        vi.stubEnv('NODE_ENV', 'test');
    });

    it('returns 401 in production when authorization is invalid', async () => {
        vi.stubEnv('NODE_ENV', 'production');

        const req = new Request('http://localhost/api/cron/cleanup-bookings', {
            method: 'GET',
            headers: {
                authorization: 'Bearer wrong',
            },
        });

        const res = await GET(req);

        expect(res.status).toBe(401);
    });

    it('expires stale pending bookings and notifies the guest', async () => {
        (prisma.booking.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 'booking-expired-pending-1',
                    guest: { name: 'C', email: 'c@example.com' },
                    roomType: { name: 'R3' },
                    checkIn: new Date('2026-02-10'),
                    checkOut: new Date('2026-02-11'),
                    totalPrice: 300,
                    payment: null,
                },
            ]);

        (prisma.booking.update as any).mockResolvedValue({});
        (prisma.booking.updateMany as any).mockResolvedValue({ count: 1 });
        (prisma.couponRedemption.updateMany as any).mockResolvedValue({ count: 1 });

        const req = new Request('http://localhost/api/cron/cleanup-bookings', {
            method: 'GET',
            headers: {
                authorization: 'Bearer secret',
            },
        });

        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.couponReleaseCount).toBe(1);
        expect(sendBookingExpiredEmail).toHaveBeenCalledWith(expect.objectContaining({
            bookingId: 'booking-expired-pending-1',
        }));
        expect(sendBookingStatusAlertEmail).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'booking-expired-pending-1' }),
            expect.objectContaining({ bookingStatus: 'EXPIRED' })
        );
        expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
        expect(prisma.couponRedemption.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    bookingId: { in: ['booking-expired-pending-1'] },
                }),
                data: expect.objectContaining({
                    status: 'RELEASED',
                }),
            })
        );
    });

});
