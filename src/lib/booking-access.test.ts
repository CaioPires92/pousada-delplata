// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    authorizeBookingRequest,
    getBookingAccessCookieName,
    signBookingAccessToken,
} from './booking-access';

const originalSecret = process.env.BOOKING_ACCESS_SECRET;
const originalAdminSecret = process.env.ADMIN_JWT_SECRET;

describe('booking access', () => {
    beforeEach(() => {
        process.env.BOOKING_ACCESS_SECRET = 'booking-access-test-secret-with-enough-entropy';
        delete process.env.ADMIN_JWT_SECRET;
    });

    afterEach(() => {
        if (originalSecret === undefined) delete process.env.BOOKING_ACCESS_SECRET;
        else process.env.BOOKING_ACCESS_SECRET = originalSecret;
        if (originalAdminSecret === undefined) delete process.env.ADMIN_JWT_SECRET;
        else process.env.ADMIN_JWT_SECRET = originalAdminSecret;
    });

    it('authorizes only the booking encoded in the signed token', async () => {
        const token = await signBookingAccessToken('booking-1');
        expect(token).toBeTruthy();

        const request = new Request('https://example.com/api/bookings/booking-1', {
            headers: { 'x-booking-access-token': String(token) },
        });

        await expect(authorizeBookingRequest(request, 'booking-1')).resolves.toMatchObject({ authorized: true });
        await expect(authorizeBookingRequest(request, 'booking-2')).resolves.toMatchObject({ authorized: false });
    });

    it('accepts the scoped HTTP-only cookie', async () => {
        const token = await signBookingAccessToken('booking-1');
        const cookieName = getBookingAccessCookieName('booking-1');
        const request = new Request('https://example.com/api/bookings/booking-1', {
            headers: { cookie: `${cookieName}=${token}` },
        });

        await expect(authorizeBookingRequest(request, 'booking-1')).resolves.toMatchObject({ authorized: true });
    });

    it('rejects requests without a signed credential', async () => {
        const request = new Request('https://example.com/api/bookings/booking-1');
        await expect(authorizeBookingRequest(request, 'booking-1')).resolves.toEqual({
            authorized: false,
            token: null,
        });
    });

    it('keeps existing tokens valid while moving from the admin secret', async () => {
        delete process.env.BOOKING_ACCESS_SECRET;
        process.env.ADMIN_JWT_SECRET = 'legacy-admin-secret-with-enough-entropy';
        const token = await signBookingAccessToken('booking-1');

        process.env.BOOKING_ACCESS_SECRET = 'new-booking-secret-with-enough-entropy';
        const request = new Request('https://example.com/api/bookings/booking-1', {
            headers: { 'x-booking-access-token': String(token) },
        });

        await expect(authorizeBookingRequest(request, 'booking-1')).resolves.toMatchObject({ authorized: true });
    });
});
