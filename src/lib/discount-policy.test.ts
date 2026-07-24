import { describe, expect, it } from 'vitest';
import {
    normalizeDiscountPolicy,
    stayOverlapsBlockedRange,
    validateDiscountPolicy,
} from './discount-policy';

describe('discount policy', () => {
    it('detects a stay that overlaps a blocked holiday range', () => {
        expect(stayOverlapsBlockedRange({
            checkIn: '2026-12-29',
            checkOut: '2027-01-02',
            blockedDateRanges: [{ start: '2026-12-30', end: '2027-01-01', label: 'Réveillon' }],
        })).toBe(true);
    });

    it('does not block a stay starting after the blocked range', () => {
        expect(stayOverlapsBlockedRange({
            checkIn: '2027-01-02',
            checkOut: '2027-01-04',
            blockedDateRanges: [{ start: '2026-12-30', end: '2027-01-01', label: 'Réveillon' }],
        })).toBe(false);
    });

    it('rejects unsafe policy values', () => {
        const policy = normalizeDiscountPolicy({ percentage: 80, validityDays: 0 });
        const result = validateDiscountPolicy(policy);
        expect(result.valid).toBe(false);
        expect(result.errors.percentage).toBeTruthy();
        expect(result.errors.validityDays).toBeTruthy();
    });
});
