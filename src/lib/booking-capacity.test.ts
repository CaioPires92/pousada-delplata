import { describe, expect, it } from 'vitest';
import { MAX_BOOKING_ADULTS, MAX_BOOKING_GUESTS, exceedsRoomCapacity, needsExtraChildNotice } from './booking-capacity';

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

    it('no STD (até 3 pagantes) cabe só 1 pessoa a mais', () => {
        expect(exceedsRoomCapacity({ adults: 2, children: 2, childrenAges: [1, 2] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 3, children: 1, childrenAges: [2] })).toBe(false);
        expect(exceedsRoomCapacity({ adults: 3, children: 2, childrenAges: [1, 2] })).toBe(true);
        expect(exceedsRoomCapacity({ adults: 2, children: 3, childrenAges: [1, 2, 3] })).toBe(true);
    });

    it('aviso só quando a criança de 0 a 5 anos passa a capacidade do quarto', () => {
        const triplo = { capacity: 3, maxGuests: 3 };
        const quadruplo = { capacity: 3, maxGuests: 4 };
        // cabe na capacidade: sem aviso
        expect(needsExtraChildNotice({ adults: 2, childrenAges: [2] }, triplo)).toBe(false);
        expect(needsExtraChildNotice({ adults: 2, childrenAges: [2] }, quadruplo)).toBe(false);
        expect(needsExtraChildNotice({ adults: 3, childrenAges: [] }, triplo)).toBe(false);
        expect(needsExtraChildNotice({ adults: 4, childrenAges: [] }, quadruplo)).toBe(false);
        // capacidade + 1 criança: com aviso
        expect(needsExtraChildNotice({ adults: 3, childrenAges: [2] }, triplo)).toBe(true);
        expect(needsExtraChildNotice({ adults: 2, childrenAges: [11, 5] }, quadruplo)).toBe(true);
        expect(needsExtraChildNotice({ adults: 4, childrenAges: [2] }, quadruplo)).toBe(true);
        // 4 pagantes no quarto de 4, sem criança pequena: sem aviso
        expect(needsExtraChildNotice({ adults: 2, childrenAges: [8, 9] }, quadruplo)).toBe(false);
    });
});
