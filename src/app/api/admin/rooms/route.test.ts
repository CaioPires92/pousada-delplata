import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { GET, POST, PATCH } from './route';
import { requireAdminAuth } from '@/lib/admin-auth';

vi.mock('@/lib/prisma', () => ({
    default: {
        roomType: {
            findMany: vi.fn(),
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        rate: {
            updateMany: vi.fn(),
        },
        $transaction: vi.fn(async (fn: any) => fn(prisma)),
    },
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(),
}));

describe('Admin Rooms API /api/admin/rooms', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (requireAdminAuth as any).mockResolvedValue({ sub: 'admin-1', email: 'admin@example.com' });
    });

    it('normalizes whitespace when creating a room', async () => {
        (prisma.roomType.create as any).mockResolvedValue({ id: 'room-1' });

        const req = new Request('http://localhost/api/admin/rooms', {
            method: 'POST',
            body: JSON.stringify({
                name: '  Chalé  ',
                description: '  descrição  ',
                capacity: ' 3 ',
                totalUnits: ' 5 ',
                inventoryFor4Guests: ' 1 ',
                basePrice: ' 399.90 ',
                amenities: ' wifi, piscina ',
                photos: [' https://img.test/a.jpg ', '', null],
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(201);
        expect(prisma.roomType.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                name: 'Chalé',
                description: 'descrição',
                capacity: 3,
                totalUnits: 5,
                inventoryFor4Guests: 1,
                maxGuests: 4,
                basePrice: 399.9,
                amenities: 'wifi, piscina',
            }),
        }));
    });

    it('normalizes whitespace and clamps inventory in batch update', async () => {
        (prisma.roomType.findMany as any).mockResolvedValue([
            { id: 'room-1', basePrice: 300, totalUnits: 4, inventoryFor4Guests: 1 },
        ]);
        (prisma.roomType.update as any).mockResolvedValue({ id: 'room-1' });
        (prisma.rate.updateMany as any).mockResolvedValue({ count: 1 });

        const req = new Request('http://localhost/api/admin/rooms', {
            method: 'PATCH',
            body: JSON.stringify({
                roomTypeId: ' room-1 ',
                totalUnits: ' 6 ',
                inventoryFor4Guests: ' 10 ',
                basePrice: ' 350 ',
                capacity: ' 4 ',
            }),
        });

        const res = await PATCH(req);

        expect(res.status).toBe(200);
        expect(prisma.roomType.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: ' room-1 ' },
            data: expect.objectContaining({
                totalUnits: 6,
                inventoryFor4Guests: 6,
                maxGuests: 4,
                basePrice: 350,
                capacity: 4,
            }),
        }));
    });

    it('returns the auth response when unauthorized', async () => {
        (requireAdminAuth as any).mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const res = await GET();

        expect(res.status).toBe(401);
    });
});
