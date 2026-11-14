import { beforeEach, describe, expect, it, vi } from 'vitest';

import prisma from '@/lib/prisma';
import { hospedinClient } from '@/lib/hospedin';
import { syncHospedinAvailability } from './hospedin-sync';

vi.mock('@/lib/prisma', () => ({
  default: {
    roomType: { findMany: vi.fn() },
    inventoryAdjustment: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
    rate: { upsert: vi.fn() },
  },
}));

vi.mock('@/lib/hospedin', () => ({
  hospedinClient: { getAvailability: vi.fn() },
}));

describe('syncHospedinAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.roomType.findMany as any).mockResolvedValue([
      { id: 'room-1', name: 'Quarto', totalUnits: 6, externalId: 'hospedin-1' },
    ]);
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
    (prisma.inventoryAdjustment.upsert as any).mockResolvedValue({});
    (prisma.inventoryAdjustment.updateMany as any).mockResolvedValue({ count: 0 });
    (prisma.inventoryAdjustment.createMany as any).mockResolvedValue({ count: 1 });
    (hospedinClient.getAvailability as any).mockResolvedValue([
      { date: '2026-11-01', availability: 6, rate_price: 0 },
    ]);
  });

  it('stores raw Hospedin inventory and publishes one fewer unit', async () => {
    await syncHospedinAvailability({ beginDate: '2026-11-01', endDate: '2026-11-01' });

    expect(prisma.inventoryAdjustment.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        roomTypeId: 'room-1',
        dateKey: '2026-11-01',
        hospedinUnits: 6,
        manualOverrideUnits: null,
        totalUnits: 5,
        occupiedUnits: 0,
      })],
    });
    expect(prisma.inventoryAdjustment.upsert).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing manual override', async () => {
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([
      { dateKey: '2026-11-01', manualOverrideUnits: 2 },
    ]);

    const result = await syncHospedinAvailability({ beginDate: '2026-11-01', endDate: '2026-11-01' });

    expect(prisma.inventoryAdjustment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        hospedinUnits: 6,
        manualOverrideUnits: 2,
        totalUnits: 2,
      }),
    }));
    expect(result.results[0]).toMatchObject({
      manualOverrides: [{
        date: '2026-11-01',
        hospedinUnits: 6,
        automaticUnits: 5,
        manualUnits: 2,
      }],
    });
  });

  it('never writes prices, even when Hospedin reports a rate_price', async () => {
    (hospedinClient.getAvailability as any).mockResolvedValue([
      { date: '2026-11-01', availability: 6, rate_price: 799 },
    ]);

    await syncHospedinAvailability({ beginDate: '2026-11-01', endDate: '2026-11-01' });

    expect(prisma.rate.upsert).not.toHaveBeenCalled();
    expect(prisma.inventoryAdjustment.createMany).toHaveBeenCalledTimes(1);
  });

  it('only stamps the sync time on days that did not change, without rewriting them', async () => {
    (hospedinClient.getAvailability as any).mockResolvedValue([
      { date: '2026-11-01', availability: 6, rate_price: 0 }, // igual ao banco
      { date: '2026-11-02', availability: 3, rate_price: 0 }, // mudou (era 6)
    ]);
    (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([
      { dateKey: '2026-11-01', hospedinUnits: 6, manualOverrideUnits: null, totalUnits: 5, occupiedUnits: 0 },
      { dateKey: '2026-11-02', hospedinUnits: 6, manualOverrideUnits: null, totalUnits: 5, occupiedUnits: 0 },
    ]);

    const result = await syncHospedinAvailability({ beginDate: '2026-11-01', endDate: '2026-11-02' });

    expect(prisma.inventoryAdjustment.createMany).not.toHaveBeenCalled();
    expect(prisma.inventoryAdjustment.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryAdjustment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { roomTypeId_dateKey: { roomTypeId: 'room-1', dateKey: '2026-11-02' } },
      update: expect.objectContaining({ hospedinUnits: 3, totalUnits: 2 }),
    }));
    expect(prisma.inventoryAdjustment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { roomTypeId: 'room-1', dateKey: { in: ['2026-11-01'] } },
      data: { hospedinSyncedAt: expect.any(Date) },
    }));
    expect(result.results[0]).toMatchObject({ daysSynced: 2, daysChanged: 1 });
  });

  it('inserts many new days in batches instead of one query per day', async () => {
    const days = Array.from({ length: 250 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 10, 1 + index)).toISOString().slice(0, 10),
      availability: 4,
      rate_price: 0,
    }));
    (hospedinClient.getAvailability as any).mockResolvedValue(days);

    const result = await syncHospedinAvailability({ beginDate: days[0].date, endDate: days[249].date });

    const batchSizes = (prisma.inventoryAdjustment.createMany as any).mock.calls.map(
      (call: any[]) => call[0].data.length
    );
    expect(batchSizes).toEqual([100, 100, 50]);
    expect(prisma.inventoryAdjustment.upsert).not.toHaveBeenCalled();
    expect(result.results[0]).toMatchObject({ daysSynced: 250, daysChanged: 250 });
  });

  it('falls back to one-by-one upserts if a batch collides with a concurrent sync', async () => {
    (prisma.inventoryAdjustment.createMany as any).mockRejectedValue(new Error('Unique constraint failed'));

    const result = await syncHospedinAvailability({ beginDate: '2026-11-01', endDate: '2026-11-01' });

    expect(prisma.inventoryAdjustment.upsert).toHaveBeenCalledTimes(1);
    expect(result.results[0]).toMatchObject({ daysSynced: 1 });
    expect(result.results[0]).not.toHaveProperty('error');
  });

  it('treats an empty Hospedin response as an error, not as a successful sync', async () => {
    (hospedinClient.getAvailability as any).mockResolvedValue([]);

    const result = await syncHospedinAvailability({ beginDate: '2026-11-01', endDate: '2026-11-30' });

    expect(result.results[0]).toMatchObject({
      roomName: 'Quarto',
      error: expect.stringContaining('não devolveu nenhum dia'),
    });
    expect(prisma.inventoryAdjustment.createMany).not.toHaveBeenCalled();
    expect(prisma.inventoryAdjustment.updateMany).not.toHaveBeenCalled();
  });

  it('treats a response in an unexpected format as an error with a readable message', async () => {
    (hospedinClient.getAvailability as any).mockResolvedValue({ error: 'unexpected' });

    const result = await syncHospedinAvailability({ beginDate: '2026-11-01', endDate: '2026-11-30' });

    expect(result.results[0]).toMatchObject({ error: expect.stringContaining('não devolveu nenhum dia') });
    expect(prisma.inventoryAdjustment.upsert).not.toHaveBeenCalled();
  });

  it('reports a per-room error instead of throwing when Hospedin refuses', async () => {
    (hospedinClient.getAvailability as any).mockRejectedValue(new Error('Hospedin API Error: Forbidden'));

    const result = await syncHospedinAvailability({ beginDate: '2026-11-01', endDate: '2026-11-01' });

    expect(result.results[0]).toEqual({ roomName: 'Quarto', error: 'Hospedin API Error: Forbidden' });
    expect(prisma.inventoryAdjustment.createMany).not.toHaveBeenCalled();
    expect(prisma.inventoryAdjustment.upsert).not.toHaveBeenCalled();
  });
});
