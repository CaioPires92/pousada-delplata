import { describe, it, expect } from 'vitest';
import { nextDayKey, prevDayKey, eachDayKeyInclusive, isNextDay, compareDayKey } from './day-key';

describe('day-key utilities (extra coverage)', () => {
  it('nextDayKey handles month boundary', () => {
    expect(nextDayKey('2026-01-31')).toBe('2026-02-01');
  });

  it('prevDayKey handles year boundary', () => {
    expect(prevDayKey('2026-01-01')).toBe('2025-12-31');
  });

  it('isNextDay detects consecutive keys', () => {
    expect(isNextDay('2026-02-28', '2026-03-01')).toBe(true);
    expect(isNextDay('2026-02-28', nextDayKey('2026-02-28'))).toBe(true);
  });

  it('eachDayKeyInclusive returns full range', () => {
    const range = eachDayKeyInclusive('2026-02-27', '2026-03-02');
    expect(range).toEqual(['2026-02-27','2026-02-28','2026-03-01','2026-03-02']);
    expect(compareDayKey(range[0], range[1])).toBeLessThan(0);
  });

  it('eachDayKeyInclusive throws when start > end', () => {
    expect(() => eachDayKeyInclusive('2026-03-02', '2026-02-27')).toThrow();
  });
});
