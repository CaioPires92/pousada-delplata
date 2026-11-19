import { describe, expect, it } from 'vitest';
import { MAX_BOOKING_GUESTS } from './booking-capacity';

describe('booking capacity', () => {
    it('matches the largest Delplata room (4 guests)', () => {
        expect(MAX_BOOKING_GUESTS).toBe(4);
    });
});
