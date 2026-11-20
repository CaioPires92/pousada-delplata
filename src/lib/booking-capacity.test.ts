import { describe, expect, it } from 'vitest';
import { MAX_BOOKING_ADULTS, MAX_BOOKING_GUESTS, exceedsRoomCapacity } from './booking-capacity';

describe('booking capacity', () => {
    it('um quarto recebe até 4 pessoas, até 4 delas pagantes', () => {
        expect(MAX_BOOKING_ADULTS).toBe(4);
        expect(MAX_BOOKING_GUESTS).toBe(4);
    });

    it('aceita até 4 pagantes (adultos e crianças de 6 a 11 anos)', () => {
        expect(exceedsRoomCapacity({ adults: 3 })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 4 })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 3, children: 1, childrenAges: [5] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 3, children: 1, childrenAges: [6] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 2, children: 2, childrenAges: [11, 5] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 2, children: 2, childrenAges: [8, 9] })).toBe(false);
    });

    it('recusa mais de 4 pessoas no total', () => {
        expect(exceedsRoomCapacity({ adults: 5 })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 4, children: 1, childrenAges: [2] })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 3, children: 2, childrenAges: [1, 2] })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 3, children: 2, childrenAges: [1, null] })).toBe(true);
    });
});
