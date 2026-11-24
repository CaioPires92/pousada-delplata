import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();

vi.mock('@/lib/hospedin', () => ({
  hospedinV3: { request: (...args: unknown[]) => request(...args) },
  isHospedinV3Configured: vi.fn(() => true),
}));

import { isHospedinV3Configured } from '@/lib/hospedin';
import { isValidIsoDate, listCheckinRows } from './hospedin-checkin';

function reservation(id: string, units: Array<Record<string, unknown>>, guestId: number | null = 10) {
  return { id, attributes: { kind: 'single', guest_id: guestId, units } };
}

function unit(overrides: Record<string, unknown> = {}) {
  return {
    unit_id: 1,
    place_id: 5,
    status: 'reservation',
    check_in: '2026-11-27T14:00:00-03:00',
    check_out: '2026-11-29T12:00:00-03:00',
    adults: 2,
    children: 0,
    guest_id: 10,
    check_in_online_url: 'https://checkin.hospedin.com/token-1',
    ...overrides,
  };
}

describe('listCheckinRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isHospedinV3Configured).mockReturnValue(true);
  });

  it('joins units with the guest contact and the online check-in link', async () => {
    request.mockImplementation(async (_method: string, path: string) => {
      if (path.startsWith('bookings')) return { data: [reservation('r_1', [unit()])], links: {} };
      if (path === 'guests/10') {
        return { data: { attributes: { name: 'Carla Cliente', contact: { ddi: 'BR', phone: '19999654866' } } } };
      }
      throw new Error(`unexpected ${path}`);
    });

    const listing = await listCheckinRows('2026-11-25', '2026-11-30');

    expect(listing.rows).toHaveLength(1);
    expect(listing.rows[0]).toMatchObject({
      key: 'r_1:1',
      guestName: 'Carla Cliente',
      phone: '5519999654866',
      phoneIssue: null,
      checkinUrl: 'https://checkin.hospedin.com/token-1',
    });
    expect(listing.diagnostics).toEqual({ units: 1, withLink: 1, withPhone: 1 });
    expect(request.mock.calls[0][1]).toContain('filter[status]=pre_reservation,reservation');
    expect(request.mock.calls[0][1]).toContain('filter[check_in][gte]=2026-11-25');
  });

  it('flags missing phone and missing link, and skips canceled or out-of-range units', async () => {
    request.mockImplementation(async (_method: string, path: string) => {
      if (path.startsWith('bookings')) {
        return {
          data: [
            reservation('r_2', [unit({ unit_id: 2, check_in_online_url: null })], 11),
            reservation('r_3', [unit({ unit_id: 3, status: 'canceled' })]),
            reservation('r_4', [unit({ unit_id: 4, check_in: '2026-12-20T14:00:00-03:00' })]),
          ],
          links: {},
        };
      }
      return { data: { attributes: { name: 'Sem Telefone', contact: null } } };
    });

    const listing = await listCheckinRows('2026-11-25', '2026-11-30');

    expect(listing.rows).toHaveLength(1);
    expect(listing.rows[0]).toMatchObject({ unitId: 2, phone: null, phoneIssue: 'Sem telefone no Hospedin', checkinUrl: null });
    expect(listing.diagnostics).toEqual({ units: 1, withLink: 0, withPhone: 0 });
  });

  it('follows pagination and tolerates a guest lookup failure', async () => {
    request.mockImplementation(async (_method: string, path: string) => {
      if (path === 'bookings?page[after]=abc') {
        return { data: [reservation('r_6', [unit({ unit_id: 6, check_in: '2026-11-26T14:00:00-03:00' })])], links: {} };
      }
      if (path.startsWith('bookings?')) {
        return {
          data: [reservation('r_5', [unit({ unit_id: 5 })])],
          links: { next: 'https://pms-api.hospedin.com/api/v3/bookings?page[after]=abc' },
        };
      }
      throw new Error('guest down');
    });

    const listing = await listCheckinRows('2026-11-25', '2026-11-30');

    expect(listing.rows.map((row) => row.unitId)).toEqual([6, 5]);
    expect(listing.rows[0].guestName).toBe('Hóspede');
    expect(listing.rows[0].phone).toBeNull();
  });

  it('fails clearly when the v3 credentials are missing', async () => {
    vi.mocked(isHospedinV3Configured).mockReturnValue(false);
    await expect(listCheckinRows('2026-11-25', '2026-11-30')).rejects.toThrow('hospedin_v3_not_configured');
    expect(request).not.toHaveBeenCalled();
  });
});

describe('isValidIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isValidIsoDate('2026-11-27')).toBe(true);
    expect(isValidIsoDate('27/11/2026')).toBe(false);
    expect(isValidIsoDate('2026-13-40')).toBe(false);
  });
});
