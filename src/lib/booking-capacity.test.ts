import { describe, expect, it } from 'vitest';
import { MAX_BOOKING_ADULTS, MAX_BOOKING_GUESTS, exceedsRoomCapacity, hasFreeChild } from './booking-capacity';

describe('booking capacity', () => {
    it('um quarto recebe até 4 pagantes e mais 1 criança de 0 a 5 anos', () => {
        expect(MAX_BOOKING_ADULTS).toBe(4);
        expect(MAX_BOOKING_GUESTS).toBe(5);
    });

    it('aceita até 4 pagantes (adultos e crianças de 6 a 11 anos)', () => {
        expect(exceedsRoomCapacity({ adults: 4 })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 3, children: 1, childrenAges: [6] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 2, children: 2, childrenAges: [11, 5] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 2, children: 2, childrenAges: [8, 9] })).toBe(false);
    });

    it('aceita 4 pagantes mais 1 criança de 0 a 5 anos', () => {
        expect(exceedsRoomCapacity({ adults: 4, children: 1, childrenAges: [2] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 3, children: 2, childrenAges: [8, 5] })).toBe(false);
    });

    it('recusa 5 pagantes ou mais de 5 pessoas', () => {
        expect(exceedsRoomCapacity({ adults: 5 })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 4, children: 1, childrenAges: [6] })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 4, children: 2, childrenAges: [1, 2] })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 4, children: 2, childrenAges: [1, null] })).toBe(true);
    });

    it('identifica criança de 0 a 5 anos para o aviso', () => {
        expect(hasFreeChild([11, 5])).toBe(true);
        expect(hasFreeChild([0])).toBe(true);
        expect(hasFreeChild([6, 11])).toBe(false);
        expect(hasFreeChild([null])).toBe(false);
    });
});
