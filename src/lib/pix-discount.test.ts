import { describe, expect, it } from 'vitest';
import { applyPixDiscount, isPixDiscountEnabled } from './pix-discount';

describe('pix discount', () => {
    it('stays disabled', () => {
        expect(isPixDiscountEnabled()).toBe(false);
    });

    it('applies the configured fixed rate with currency rounding', () => {
        expect(applyPixDiscount(100)).toBe(95);
        expect(applyPixDiscount(99.99)).toBe(94.99);
    });
});
