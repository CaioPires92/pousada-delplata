import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';
import { requireAdminAuth } from '@/lib/admin-auth';
import { listCheckinRows } from '@/lib/hospedin-checkin';

vi.mock('@/lib/admin-auth', () => ({ requireAdminAuth: vi.fn() }));
vi.mock('@/lib/hospedin-checkin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hospedin-checkin')>('@/lib/hospedin-checkin');
  return { ...actual, listCheckinRows: vi.fn() };
});

const listing = { from: '2026-11-25', to: '2026-11-30', rows: [], diagnostics: { units: 0, withLink: 0, withPhone: 0 } };

describe('GET /api/admin/checkin-online', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminAuth).mockResolvedValue({ adminId: 'admin-1' } as never);
    vi.mocked(listCheckinRows).mockResolvedValue(listing);
  });

  it('requires an admin session', async () => {
    vi.mocked(requireAdminAuth).mockResolvedValue(new Response('{}', { status: 401 }) as never);
    const response = await GET(new Request('http://localhost/api/admin/checkin-online'));
    expect(response.status).toBe(401);
    expect(listCheckinRows).not.toHaveBeenCalled();
  });

  it('returns the listing without caching', async () => {
    const response = await GET(new Request('http://localhost/api/admin/checkin-online?from=2026-11-25&to=2026-11-30'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(listCheckinRows).toHaveBeenCalledWith('2026-11-25', '2026-11-30');
  });

  it('rejects invalid and too long periods', async () => {
    const invalid = await GET(new Request('http://localhost/api/admin/checkin-online?from=2026-11-30&to=2026-11-25'));
    expect(invalid.status).toBe(400);
    const long = await GET(new Request('http://localhost/api/admin/checkin-online?from=2026-01-01&to=2026-06-01'));
    expect(long.status).toBe(400);
    expect(listCheckinRows).not.toHaveBeenCalled();
  });

  it('reports missing credentials as 503 and Hospedin failures as 502', async () => {
    vi.mocked(listCheckinRows).mockRejectedValueOnce(new Error('hospedin_v3_not_configured'));
    const missing = await GET(new Request('http://localhost/api/admin/checkin-online?from=2026-11-25&to=2026-11-30'));
    expect(missing.status).toBe(503);

    vi.mocked(listCheckinRows).mockRejectedValueOnce(new Error('boom'));
    const failed = await GET(new Request('http://localhost/api/admin/checkin-online?from=2026-11-25&to=2026-11-30'));
    expect(failed.status).toBe(502);
  });
});
