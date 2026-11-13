import { describe, expect, it } from 'vitest';

import { getEffectiveGuestCounts, requiresFourGuestInventory } from './guest-capacity';

describe('guest capacity', () => {
    it('does not count children aged zero to five as paying capacity', () => {
        const counts = getEffectiveGuestCounts({ adults: 2, childrenAges: [5, 3] });

        expect(counts.effectiveGuests).toBe(2);
        expect(counts.totalGuests).toBe(4);
        expect(counts.freeChildren).toBe(2);
        expect(requiresFourGuestInventory(counts.effectiveGuests)).toBe(false);
    });

    it('counts children aged six to eleven and teenagers as paying capacity', () => {
        const counts = getEffectiveGuestCounts({ adults: 2, childrenAges: [5, 8, 12] });

        expect(counts.effectiveAdults).toBe(3);
        expect(counts.payingChildren).toBe(1);
        expect(counts.effectiveGuests).toBe(4);
        expect(counts.totalGuests).toBe(5);
        expect(requiresFourGuestInventory(counts.effectiveGuests)).toBe(true);
    });
});
