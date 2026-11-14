import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';
import { syncHospedinAvailability } from '@/lib/hospedin-sync';

vi.mock('@/lib/admin-auth', () => ({
  requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1' })),
}));

vi.mock('@/lib/hospedin-sync', () => ({
  getDefaultHospedinPeriod: vi.fn(() => ({ beginDate: '2026-11-01', endDate: '2026-11-30' })),
  syncHospedinAvailability: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    inventoryAdjustment: { findMany: vi.fn(async () => []) },
  },
}));

describe('POST /api/admin/hospedin-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('HOSPEDIN_SYNC_ENABLED', 'true');
    (syncHospedinAvailability as any).mockResolvedValue({
      beginDate: '2026-11-01',
      endDate: '2026-11-30',
      results: [{ roomName: 'Quarto', daysSynced: 30 }],
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('does not contact Hospedin when administrative sync is disabled', async () => {
    vi.stubEnv('HOSPEDIN_SYNC_ENABLED', 'false');

    const response = await POST(new Request('http://localhost/api/admin/hospedin-sync', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(503);
    expect(syncHospedinAvailability).not.toHaveBeenCalled();
  });

  it('syncs only when explicitly requested by an admin', async () => {
    const response = await POST(new Request('http://localhost/api/admin/hospedin-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-11-05', endDate: '2026-11-10', roomTypeId: 'room-1' }),
    }));

    expect(response.status).toBe(200);
    expect(syncHospedinAvailability).toHaveBeenCalledWith({
      beginDate: '2026-11-05',
      endDate: '2026-11-10',
      roomTypeId: 'room-1',
    });
  });

  it('returns an error when every accommodation fails to synchronize', async () => {
    (syncHospedinAvailability as any).mockResolvedValue({
      beginDate: '2026-11-01',
      endDate: '2026-11-30',
      results: [
        { roomName: 'Quarto Triplo', error: 'Hospedin Auth Failed: Unauthorized' },
        { roomName: 'Quarto Quádruplo', error: 'Hospedin Auth Failed: Unauthorized' },
      ],
    });

    const response = await POST(new Request('http://localhost/api/admin/hospedin-sync', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      error: 'O Hospedin não sincronizou nenhuma acomodação.',
    }));
  });
});
