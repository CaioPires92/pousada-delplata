import { beforeEach, describe, expect, it, vi } from 'vitest';

import prisma from '@/lib/prisma';
import { sendBookingExpiredEmail } from '@/lib/email';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';
import {
    expireStalePendingBookings,
    runPendingBookingMaintenance,
} from './expire-stale-bookings';

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: { findMany: vi.fn(), updateMany: vi.fn() },
        couponRedemption: { updateMany: vi.fn() },
        paymentAttempt: { findMany: vi.fn() },
    },
}));
vi.mock('@/lib/email', () => ({
    sendBookingExpiredEmail: vi.fn(),
}));
vi.mock('@/lib/booking-status-alert', () => ({ sendBookingStatusAlertEmail: vi.fn() }));
vi.mock('@/lib/ops-log', () => ({ opsLog: vi.fn() }));

const db = prisma as any;

function booking(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        status: 'PENDING',
        checkIn: new Date(Date.now() + 10 * 86_400_000),
        checkOut: new Date(Date.now() + 12 * 86_400_000),
        totalPrice: 1000,
        adults: 2,
        children: 0,
        childrenAges: null,
        pets: 0,
        funnelStage: 'PAYMENT_REJECTED',
        lastErrorMessage: null,
        createdAt: new Date(Date.now() - 30 * 3_600_000),
        expiredEmailSentAt: null,
        pendingEmailSentAt: null,
        guest: { name: 'Hóspede', email: 'hospede@example.test', phone: null },
        roomType: { name: 'Quarto' },
        payment: null,
        ...overrides,
    };
}

function updatesWith(field: string, value: unknown) {
    return db.booking.updateMany.mock.calls.filter(([args]: any[]) => args?.data?.[field] === value);
}

describe('expireStalePendingBookings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.booking.updateMany.mockResolvedValue({ count: 1 });
        db.couponRedemption.updateMany.mockResolvedValue({ count: 1 });
        db.paymentAttempt.findMany.mockResolvedValue([]);
        vi.mocked(sendBookingExpiredEmail).mockResolvedValue({ success: true });
        vi.mocked(sendBookingStatusAlertEmail).mockResolvedValue({ success: true } as any);
    });

    it('expires, releases the coupon, emails the guest once and alerts the team', async () => {
        db.booking.findMany.mockResolvedValue([booking('b1')]);

        const summary = await expireStalePendingBookings({ source: 'test', sendAdminAlerts: true });

        expect(summary).toMatchObject({ expiredCount: 1, couponReleaseCount: 1, guestExpiredEmailCount: 1, alertCount: 1 });
        expect(db.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'b1', status: 'PENDING' },
            data: expect.objectContaining({ status: 'EXPIRED' }),
        }));
        expect(db.booking.updateMany).toHaveBeenCalledWith({
            where: { id: 'b1', expiredEmailSentAt: null },
            data: { expiredEmailSentAt: expect.any(Date) },
        });
        expect(sendBookingExpiredEmail).toHaveBeenCalledTimes(1);
    });

    it('sends the guest email even when admin alerts are off', async () => {
        db.booking.findMany.mockResolvedValue([booking('b1')]);

        await expireStalePendingBookings({ source: 'test', sendAdminAlerts: false });

        expect(sendBookingExpiredEmail).toHaveBeenCalledTimes(1);
        expect(sendBookingStatusAlertEmail).not.toHaveBeenCalled();
    });

    it('does not expire a booking whose card payment is under review', async () => {
        db.booking.findMany.mockResolvedValue([booking('b1'), booking('b2')]);
        db.paymentAttempt.findMany.mockResolvedValue([{ bookingId: 'b1' }]);

        const summary = await expireStalePendingBookings({ source: 'test', sendAdminAlerts: true });

        expect(summary).toMatchObject({ expiredCount: 1, skippedUnderReviewCount: 1 });
        expect(db.booking.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'b1', status: 'PENDING' },
        }));
    });

    it('has no side effects when another run already expired the booking', async () => {
        db.booking.findMany.mockResolvedValue([booking('b1')]);
        db.booking.updateMany.mockResolvedValueOnce({ count: 0 });

        const summary = await expireStalePendingBookings({ source: 'test', sendAdminAlerts: true });

        expect(summary.expiredCount).toBe(0);
        expect(db.couponRedemption.updateMany).not.toHaveBeenCalled();
        expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
        expect(sendBookingStatusAlertEmail).not.toHaveBeenCalled();
    });

    it('does not resend the guest email when it was already sent', async () => {
        db.booking.findMany.mockResolvedValue([booking('b1')]);
        db.booking.updateMany
            .mockResolvedValueOnce({ count: 1 }) // expiração
            .mockResolvedValueOnce({ count: 0 }); // e-mail já reivindicado

        await expireStalePendingBookings({ source: 'test' });

        expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
    });

    it('skips the guest email when the check-in date already passed', async () => {
        db.booking.findMany.mockResolvedValue([booking('b1', { checkIn: new Date(Date.now() - 3 * 86_400_000) })]);

        const summary = await expireStalePendingBookings({ source: 'test' });

        expect(summary.expiredCount).toBe(1);
        expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
    });

    it('frees the email marker when sending fails so a later run can retry', async () => {
        db.booking.findMany.mockResolvedValue([booking('b1')]);
        vi.mocked(sendBookingExpiredEmail).mockResolvedValue({ success: false });

        await expireStalePendingBookings({ source: 'test' });

        expect(updatesWith('expiredEmailSentAt', null)).toHaveLength(1);
    });
});

describe('runPendingBookingMaintenance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.booking.findMany.mockResolvedValue([]);
        db.paymentAttempt.findMany.mockResolvedValue([]);
    });

    it('selects only pending bookings past the room hold (deadline + grace)', async () => {
        await runPendingBookingMaintenance({ source: 'test' });
        const where = db.booking.findMany.mock.calls[0][0].where;
        expect(where.status).toBe('PENDING');
        const createdLimit = where.OR[1].createdAt.lte.getTime();
        expect(Math.abs(Date.now() - createdLimit - 120 * 60_000)).toBeLessThan(1000);
        const deadlineLimit = where.OR[0].paymentDeadlineAt.lte.getTime();
        expect(Math.abs(Date.now() - deadlineLimit - 60 * 60_000)).toBeLessThan(1000);
    });

    it('no longer sends the "pending booking" reminder', async () => {
        const result = await runPendingBookingMaintenance({ source: 'test' });
        expect(result).not.toHaveProperty('recovery');
        expect(db.booking.findMany).toHaveBeenCalledTimes(1);
    });
});
