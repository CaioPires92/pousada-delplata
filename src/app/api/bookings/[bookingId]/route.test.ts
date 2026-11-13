import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { authorizeBookingRequest } from '@/lib/booking-access';
import { GET } from './route';

vi.mock('@/lib/prisma', () => ({
    default: { booking: { findUnique: vi.fn() } },
}));

vi.mock('@/lib/booking-access', () => ({
    authorizeBookingRequest: vi.fn(),
    getBookingAccessCookieName: vi.fn(() => 'booking_access_booking-1'),
    getBookingAccessCookieOptions: vi.fn(() => ({ httpOnly: true, path: '/api/bookings/booking-1' })),
}));

const context = { params: Promise.resolve({ bookingId: 'booking-1' }) };

describe('GET booking details', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does not reveal whether a booking exists without authorization', async () => {
        vi.mocked(authorizeBookingRequest).mockResolvedValue({ authorized: false, token: null });

        const response = await GET(new Request('https://example.com/api/bookings/booking-1'), context);

        expect(response.status).toBe(404);
        expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });

    it('returns booking details to an authorized requester', async () => {
        vi.mocked(authorizeBookingRequest).mockResolvedValue({ authorized: true, token: null });
        vi.mocked(prisma.booking.findUnique).mockResolvedValue({ id: 'booking-1' } as any);

        const response = await GET(new Request('https://example.com/api/bookings/booking-1'), context);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ id: 'booking-1' });
    });
});
