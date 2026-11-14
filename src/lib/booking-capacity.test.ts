import { describe, expect, it } from 'vitest';
import { MAX_BOOKING_GUESTS } from './booking-capacity';

describe('booking capacity', () => {
    it('supports the five-guest room plus one free child', () => {
        expect(MAX_BOOKING_GUESTS).toBe(6);
    });
});
