import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import prisma from '@/lib/prisma';
import { sendAdminRecoveryAlertEmail, sendBookingExpiredEmail, sendBookingPendingEmail } from '@/lib/email';

vi.mock('@/lib/email', () => ({
    sendAdminRecoveryAlertEmail: vi.fn().mockResolvedValue({ success: true }),
    sendBookingConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendBookingCreatedAlertEmail: vi.fn().mockResolvedValue({ success: true }),
    sendBookingExpiredEmail: vi.fn().mockResolvedValue({ success: true }),
    sendBookingPendingEmail: vi.fn().mockResolvedValue({ success: true }),
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

    it('sends pending reminders after 15 minutes and expires stale bookings without emailing expiration to guests', async () => {
        (prisma.booking.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 'booking-pending-mail',
                    guest: { name: 'A', email: 'a@example.com' },
                    roomType: { name: 'R1' },
                    checkIn: new Date('2026-02-10'),
                    checkOut: new Date('2026-02-11'),
                    totalPrice: 100,
                    payment: null,
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 'booking-exp-1',
                    guest: { name: 'B', email: 'b@example.com' },
                    roomType: { name: 'R2' },
                    checkIn: new Date('2026-02-10'),
                    checkOut: new Date('2026-02-11'),
                    totalPrice: 200,
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
        expect(data.pendingEmailCount).toBe(1);
        expect(data.expiredEmailCount).toBe(0);
        expect(sendBookingPendingEmail).toHaveBeenCalledWith(expect.objectContaining({
            bookingId: 'booking-pending-mail',
        }));
        expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
        expect(sendAdminRecoveryAlertEmail).toHaveBeenCalledWith(expect.objectContaining({
            bookingId: 'booking-exp-1',
        }));
        expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
        expect(prisma.couponRedemption.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    bookingId: { in: ['booking-exp-1'] },
                }),
                data: expect.objectContaining({
                    status: 'RELEASED',
                }),
            })
        );
    });

    it('nao marca lembrete como enviado quando o SMTP falha', async () => {
        (prisma.booking.findMany as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                id: 'booking-email-failure',
                guest: { name: 'A', email: 'a@example.com', phone: null },
                roomType: { name: 'R1' },
                checkIn: new Date('2026-02-10'),
                checkOut: new Date('2026-02-11'),
                totalPrice: 100,
                payment: null,
                funnelStage: 'PAYMENT_ERROR',
                lastErrorMessage: 'card_rejected',
            }])
            .mockResolvedValueOnce([]);
        vi.mocked(sendBookingPendingEmail).mockResolvedValueOnce({ success: false, error: 'smtp_failed' });

        const res = await GET(new Request('http://localhost/api/cron/cleanup-bookings', {
            headers: { authorization: 'Bearer secret' },
        }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.pendingEmailCount).toBe(0);
        expect(prisma.booking.update).not.toHaveBeenCalled();
    });
});
