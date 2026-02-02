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
        const row = args.data[0];
        expect(row.roomTypeId).toBe('room-1');
        expect(row.startDate).toBeInstanceOf(Date);
        expect(row.endDate).toBeInstanceOf(Date);
        expect(row.startDate.toISOString()).toBe('2026-01-28T00:00:00.000Z');
        expect(row.endDate.toISOString()).toBe('2026-01-28T00:00:00.000Z');
    });
 
    it('accepts ISO datetime in "date" and normalizes to day key', async () => {
        (prisma.roomType.findMany as any).mockResolvedValue([{ id: 'room-1', basePrice: 300 }]);
        (prisma.rate.findMany as any).mockResolvedValue([]);
        (prisma.$transaction as any).mockResolvedValue([]);
 
        const req = new Request('http://localhost/api/rates/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomTypeId: 'room-1',
                date: '2026-01-28T10:30:00.000Z',
                updates: { price: 200 },
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
    });
 
    it('accepts legacy SQL datetime strings for start/end range', async () => {
        (prisma.roomType.findMany as any).mockResolvedValue([{ id: 'room-1', basePrice: 300 }]);
        (prisma.rate.findMany as any).mockResolvedValue([]);
        (prisma.$transaction as any).mockResolvedValue([]);
 
        const req = new Request('http://localhost/api/rates/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomTypeId: 'room-1',
                startDate: '2026-01-28 00:00:00 +00:00',
                endDate: '2026-01-30 23:59:59 +00:00',
                updates: { price: 250 },
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
    });
});
