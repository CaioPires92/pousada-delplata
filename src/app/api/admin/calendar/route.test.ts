import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import prisma from '@/lib/prisma';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1', email: 'admin@x.com', role: 'admin' })),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        roomType: {
            findUnique: vi.fn(),
        },
        rate: {
            findMany: vi.fn(),
        },
        inventoryAdjustment: {
            findMany: vi.fn(),
        },
        booking: {
            findMany: vi.fn(),
        },
    },
}));

describe('Admin Calendar API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.roomType.findUnique as any).mockResolvedValue({
            id: 'room-1',
            totalUnits: 3,
            basePrice: 500,
        });
        (prisma.rate.findMany as any).mockResolvedValue([]);
        (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([]);
        (prisma.booking.findMany as any).mockResolvedValue([]);
    });

    it('queries rate overlap with inclusive UTC day bounds', async () => {
        const req = new Request(
            'http://localhost/api/admin/calendar?roomTypeId=room-1&startDate=2026-02-01&endDate=2026-02-16'
        );

        const res = await GET(req);
        expect(res.status).toBe(200);

        expect(prisma.rate.findMany).toHaveBeenCalledTimes(1);
        const rateArgs = (prisma.rate.findMany as any).mock.calls[0][0];

        expect(rateArgs.where.startDate.lte.toISOString()).toBe('2026-02-16T23:59:59.999Z');
        expect(rateArgs.where.endDate.gte.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    });

    it('keeps first day stopSell when rate is exactly one day at range start', async () => {
        (prisma.rate.findMany as any).mockResolvedValue([
            {
                id: 'rate-1',
                roomTypeId: 'room-1',
                startDate: new Date('2026-02-01T00:00:00.000Z'),
                endDate: new Date('2026-02-01T00:00:00.000Z'),
                price: 500,
                stopSell: true,
                cta: false,
                ctd: false,
                minLos: 1,
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
        ]);

        const req = new Request(
            'http://localhost/api/admin/calendar?roomTypeId=room-1&startDate=2026-02-01&endDate=2026-02-03'
        );

        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();

        const d1 = data.find((d: any) => d.date === '2026-02-01');
        const d2 = data.find((d: any) => d.date === '2026-02-02');

        expect(d1?.stopSell).toBe(true);
        expect(d2?.stopSell).toBe(false);
    });
    it('uses manual inventory as final available value even when there are bookings', async () => {
        (prisma.inventoryAdjustment.findMany as any).mockResolvedValue([
            {
                roomTypeId: 'room-1',
                date: new Date('2026-02-11T12:00:00.000Z'),
                totalUnits: 1,
            },
        ]);

        (prisma.booking.findMany as any).mockResolvedValue([
            {
                checkIn: new Date('2026-02-11T00:00:00.000Z'),
                checkOut: new Date('2026-02-12T00:00:00.000Z'),
                status: 'CONFIRMED',
            },
        ]);

        const req = new Request(
            'http://localhost/api/admin/calendar?roomTypeId=room-1&startDate=2026-02-11&endDate=2026-02-11'
        );

        const res = await GET(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data[0].available).toBe(1);
        expect(data[0].bookingsCount).toBe(1);
        expect(data[0].totalInventory).toBe(1);
    });
});

