import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    getBookingPaymentWindow,
    getPaymentDeadline,
    getRoomHoldEnd,
    buildPreferenceExpirationFields,
    getPixExpiration,
    occupyingBookingWhere,
} from './booking-payment-window';

const MIN = 60_000;
const now = new Date('2026-11-12T15:00:00.000Z');

describe('booking payment window', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('defaults to 60 minutes after creation', () => {
        const createdAt = new Date(now.getTime() - 20 * MIN);
        expect(getPaymentDeadline({ createdAt }).getTime()).toBe(createdAt.getTime() + 60 * MIN);
        expect(getBookingPaymentWindow({ status: 'PENDING', createdAt }, now)).toEqual({
            open: true, deadline: new Date(createdAt.getTime() + 60 * MIN), minutesToExpire: 40,
        });
    });

    it('uses the deadline renewed by the admin', () => {
        const createdAt = new Date(now.getTime() - 3 * 24 * 60 * MIN);
        const paymentDeadlineAt = new Date(now.getTime() + 45 * MIN);
        expect(getBookingPaymentWindow({ status: 'PENDING', createdAt, paymentDeadlineAt }, now))
            .toMatchObject({ open: true, minutesToExpire: 45 });
    });

    it('closes when less than 10 minutes are left or the deadline passed', () => {
        expect(getBookingPaymentWindow({ status: 'PENDING', createdAt: new Date(now.getTime() - 55 * MIN) }, now))
            .toEqual({ open: false, reason: 'PAYMENT_WINDOW_CLOSED' });
        expect(getBookingPaymentWindow({ status: 'PENDING', createdAt: new Date(now.getTime() - 2 * 60 * MIN) }, now))
            .toEqual({ open: false, reason: 'PAYMENT_WINDOW_CLOSED' });
    });

    it('is closed for bookings that are not pending', () => {
        expect(getBookingPaymentWindow({ status: 'EXPIRED', createdAt: now }, now))
            .toEqual({ open: false, reason: 'BOOKING_NOT_PENDING' });
    });

    it('keeps the room held for a grace period after the payment link expires', () => {
        const createdAt = new Date(now.getTime() - 90 * MIN);
        expect(getRoomHoldEnd({ createdAt }).getTime()).toBe(createdAt.getTime() + 120 * MIN);
        expect(getBookingPaymentWindow({ status: 'PENDING', createdAt }, now))
            .toEqual({ open: false, reason: 'PAYMENT_WINDOW_CLOSED' });
        vi.stubEnv('PENDING_BOOKING_HOLD_GRACE_MINUTES', '40');
        expect(getRoomHoldEnd({ createdAt }).getTime()).toBe(createdAt.getTime() + 100 * MIN);
        // Nunca menor que a validade mínima do Pix (30) + margem: um Pix do fim do prazo cabe no bloqueio.
        vi.stubEnv('PENDING_BOOKING_HOLD_GRACE_MINUTES', '10');
        expect(getRoomHoldEnd({ createdAt }).getTime()).toBe(createdAt.getTime() + 95 * MIN);
    });

    it('respects a configured window', () => {
        vi.stubEnv('PENDING_BOOKING_PAYMENT_WINDOW_MINUTES', '30');
        expect(getPaymentDeadline({ createdAt: now }).getTime()).toBe(now.getTime() + 30 * MIN);
    });

    it('Pix expires 30 minutes after the deadline (MP minimum), inside the room hold', () => {
        const deadline = new Date(now.getTime() + 40 * MIN);
        expect(getPixExpiration(deadline).getTime()).toBe(deadline.getTime() + 30 * MIN);
        expect(getPixExpiration(deadline).getTime()).toBeLessThan(getRoomHoldEnd({ createdAt: now, paymentDeadlineAt: deadline }).getTime());
    });

    it('builds deterministic Checkout Pro expiration fields', () => {
        const deadline = new Date('2026-11-12T16:00:00.000Z');
        expect(buildPreferenceExpirationFields(deadline)).toEqual({
            expires: true,
            expiration_date_from: '2026-11-12T12:00:00.000-03:00',
            expiration_date_to: '2026-11-12T13:00:00.000-03:00',
            date_of_expiration: '2026-11-12T13:30:00.000-03:00',
        });
    });

    it('counts confirmed bookings and pending ones still inside the payment window', () => {
        const where = occupyingBookingWhere(now) as any;
        expect(where.OR[0]).toEqual({ status: { in: ['CONFIRMED', 'PAID'] } });
        expect(where.OR[1].status).toBe('PENDING');
        // Bloqueio = prazo do link (60) + folga (60).
        expect(where.OR[1].OR[0]).toEqual({ paymentDeadlineAt: { gt: new Date(now.getTime() - 60 * MIN) } });
        expect(where.OR[1].OR[1]).toEqual({ paymentDeadlineAt: null, createdAt: { gt: new Date(now.getTime() - 120 * MIN) } });
        expect(where.OR[1].OR[2].paymentAttempts.some.status.in).toEqual(['IN_PROCESS', 'AUTHORIZED']);
    });
});
