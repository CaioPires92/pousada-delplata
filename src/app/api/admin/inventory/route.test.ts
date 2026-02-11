import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1', email: 'admin@x.com', role: 'admin' })),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        roomType: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        booking: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        inventoryAdjustment: {
            upsert: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

describe('Admin Inventory API - day key safety', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.roomType.findUnique as any).mockResolvedValue({ id: 'room-1', totalUnits: 8 });
        (prisma.booking.count as any).mockResolvedValue(0);
        (prisma.inventoryAdjustment.upsert as any).mockResolvedValue({
            roomTypeId: 'room-1',
            dateKey: '2026-02-10',
            totalUnits: 3,
        });
    });

    it('keeps exact dateKey when saving 2026-02-10 (no shift to previous day)', async () => {
        const req = new Request('http://localhost/api/admin/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomTypeId: 'room-1',
                date: '2026-02-10',
                totalUnits: 3,
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(prisma.inventoryAdjustment.upsert).toHaveBeenCalledTimes(1);
        const upsertArgs = (prisma.inventoryAdjustment.upsert as any).mock.calls[0][0];
        expect(upsertArgs.where.roomTypeId_dateKey.dateKey).toBe('2026-02-10');
        expect(upsertArgs.update.date.toISOString()).toBe('2026-02-10T12:00:00.000Z');
        expect(upsertArgs.create.dateKey).toBe('2026-02-10');
    });

    it('accepts ISO datetime and still stores the same calendar day key', async () => {
        const req = new Request('http://localhost/api/admin/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomTypeId: 'room-1',
                date: '2026-02-10T15:45:00.000Z',
                totalUnits: 4,
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const upsertArgs = (prisma.inventoryAdjustment.upsert as any).mock.calls[0][0];
        expect(upsertArgs.where.roomTypeId_dateKey.dateKey).toBe('2026-02-10');
        expect(upsertArgs.create.date.toISOString()).toBe('2026-02-10T12:00:00.000Z');
    });
});

