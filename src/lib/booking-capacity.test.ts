import { describe, expect, it } from 'vitest';
import { MAX_BOOKING_ADULTS, MAX_BOOKING_GUESTS, exceedsRoomCapacity } from './booking-capacity';

describe('booking capacity', () => {
    it('um quarto recebe até 3 adultos e mais 1 criança de 0 a 5 anos', () => {
        expect(MAX_BOOKING_ADULTS).toBe(3);
        expect(MAX_BOOKING_GUESTS).toBe(4);
    });

    it('aceita até 3 adultos com 1 criança de 0 a 5 anos', () => {
        expect(exceedsRoomCapacity({ adults: 3 })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 3, children: 1, childrenAges: [5] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 2, children: 2, childrenAges: [8, 3] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 2, children: 2, childrenAges: [2, 4] })).toBe(false);
    });

    it('recusa 4 adultos ou mais', () => {
        expect(exceedsRoomCapacity({ adults: 4 })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 3, children: 1, childrenAges: [6] })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 3, children: 1, childrenAges: [14] })).toBe(true);
    });

    it('recusa mais de 4 pessoas no total', () => {
        expect(exceedsRoomCapacity({ adults: 3, children: 2, childrenAges: [1, 2] })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 3, children: 2, childrenAges: [1, null] })).toBe(true);
    });
});
