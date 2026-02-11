import { describe, it, expect } from 'vitest';
import { parseLocalDate, parseISODateSafe, assertYmd, ymdToIso } from './date-utils';

describe('date-utils extra coverage', () => {
  it('parseLocalDate creates local date from YYYY-MM-DD', () => {
    const d = parseLocalDate('2026-02-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(1);
  });

  it('parseISODateSafe returns start of day ISO', () => {
    const s = parseISODateSafe('2026-02-01', false);
    expect(s).toBe('2026-02-01T00:00:00.000Z');
  });

  it('parseISODateSafe returns end of day ISO', () => {
    const s = parseISODateSafe('2026-02-01', true);
    expect(s).toBe('2026-02-01T23:59:59.999Z');
  });

  it('parseISODateSafe returns null for invalid input', () => {
    const s = parseISODateSafe('invalid-date', false);
    expect(s).toBeNull();
  });

  it('assertYmd returns cleaned string for valid input', () => {
    const s = assertYmd(' 2026-02-01 ', 'startDate');
    expect(s).toBe('2026-02-01');
  });

  it('assertYmd throws for invalid format', () => {
    expect(() => assertYmd('2026-2-01', 'startDate')).toThrow();
  });

  it('ymdToIso converts to ISO midnight', () => {
    expect(ymdToIso('2026-02-01')).toBe('2026-02-01T00:00:00.000Z');
  });
});
