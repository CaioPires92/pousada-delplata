import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryAvailabilityQuote } from '@/lib/availability/quote-service';
import { hasRoomForBooking } from './room-check';

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/availability/quote-service', () => ({ queryAvailabilityQuote: vi.fn() }));

const booking = {
    roomTypeId: 'room-1',
    checkIn: new Date('2026-12-10T00:00:00.000Z'),
    checkOut: new Date('2026-12-12T00:00:00.000Z'),
    adults: 2,
    childrenAges: '[5]',
    pets: 1,
};

describe('hasRoomForBooking', () => {
    beforeEach(() => vi.clearAllMocks());

    it('is true when the booked room type still has a free unit', async () => {
        vi.mocked(queryAvailabilityQuote).mockResolvedValue({ ok: true, options: [{ roomTypeId: 'room-1', remainingUnits: 1 }] } as any);
        await expect(hasRoomForBooking(booking)).resolves.toBe(true);
        expect(queryAvailabilityQuote).toHaveBeenCalledWith(
            { checkin: '2026-12-10', checkout: '2026-12-12', adults: 2, childrenAges: [5], pets: 1 },
            expect.anything(),
        );
    });

    it('is false when only other room types are available', async () => {
        vi.mocked(queryAvailabilityQuote).mockResolvedValue({ ok: true, options: [{ roomTypeId: 'room-2', remainingUnits: 3 }] } as any);
        await expect(hasRoomForBooking(booking)).resolves.toBe(false);
    });

    it('is false (team decides) when the quote fails', async () => {
        vi.mocked(queryAvailabilityQuote).mockRejectedValue(new Error('db down'));
        await expect(hasRoomForBooking(booking)).resolves.toBe(false);
    });
});
