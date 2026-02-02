import { describe, it, expect } from 'vitest';
import { normalizeDateStr } from './date-utils';

describe('normalizeDateStr', () => {
    it('throws error for null/undefined/empty input', () => {
        expect(() => normalizeDateStr(null as any)).toThrow();
        expect(() => normalizeDateStr(undefined as any)).toThrow();
        expect(() => normalizeDateStr('')).toThrow();
    });

    it('returns ISO string from Date object', () => {
        const d = new Date('2026-02-01T00:00:00.000Z');
        expect(normalizeDateStr(d)).toBe('2026-02-01T00:00:00.000Z');
    });

    it('returns ISO string from ISO string input', () => {
        const input = '2026-02-01T15:30:00.000Z';
        expect(normalizeDateStr(input)).toBe('2026-02-01T15:30:00.000Z');
    });

    it('returns ISO string from legacy SQL string (no timezone)', () => {
        const input = '2026-02-01 00:00:00';
        expect(normalizeDateStr(input)).toBe('2026-02-01T00:00:00.000Z');
    });

    it('normalizes "YYYY-MM-DD HH:mm:ss +00:00" to ISO UTC', () => {
        const input = '2026-02-01 00:00:00 +00:00';
        expect(normalizeDateStr(input)).toBe('2026-02-01T00:00:00.000Z');
    });

    it('returns same ISO when input is ISO midnight', () => {
        const input = '2026-02-01T00:00:00.000Z';
        expect(normalizeDateStr(input)).toBe('2026-02-01T00:00:00.000Z');
    });

    it('returns ISO string if input is "YYYY-MM-DD"', () => {
        const input = '2026-02-01';
        expect(normalizeDateStr(input)).toBe('2026-02-01T00:00:00.000Z');
    });

    it('throws error for invalid format', () => {
        expect(() => normalizeDateStr('invalid-date')).toThrow();
        expect(() => normalizeDateStr('202-01-01')).toThrow();
    });
});
