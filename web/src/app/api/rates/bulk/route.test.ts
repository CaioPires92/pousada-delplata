import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1', email: 'admin@x.com', role: 'admin' })),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        roomType: {
            findMany: vi.fn(),
        },
        rate: {
            findMany: vi.fn(),
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
        inventoryAdjustment: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

describe('Rates Bulk API - day key', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should persist the same YYYY-MM-DD for single-day update', async () => {
        (prisma.roomType.findMany as any).mockResolvedValue([{ id: 'room-1', basePrice: 499 }]);
        (prisma.rate.findMany as any).mockResolvedValue([]);
        (prisma.$transaction as any).mockResolvedValue([]);

        const req = new Request('http://localhost/api/rates/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomTypeId: 'room-1',
                date: '2026-01-28',
                updates: { price: 123 },
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(prisma.rate.createMany).toHaveBeenCalledTimes(1);
        const args = (prisma.rate.createMany as any).mock.calls[0][0];
        expect(args.data).toEqual([
            expect.objectContaining({
                roomTypeId: 'room-1',
                startDate: '2026-01-28',
                endDate: '2026-01-28',
            }),
        ]);
    });
});
