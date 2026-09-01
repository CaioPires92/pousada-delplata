import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { GET, POST } from './route';
import { requireAdminAuth } from '@/lib/admin-auth';

vi.mock('@/lib/prisma', () => ({
    default: {
        coupon: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(),
}));

describe('Admin Coupons API /api/admin/coupons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ADMIN_JWT_SECRET = 'test-secret-at-least-32-characters-long';
        (requireAdminAuth as any).mockResolvedValue({ sub: 'admin-1', email: 'admin@example.com' });
    });

    it('returns coupons when authenticated', async () => {
        (prisma.coupon.findMany as any).mockResolvedValue([{ id: 'c1', name: 'VIP' }]);

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual([{ id: 'c1', name: 'VIP', code: null }]);
    });

    it('returns auth response when unauthorized', async () => {
        (requireAdminAuth as any).mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const res = await GET();

        expect(res.status).toBe(401);
    });

    it('creates coupon with normalized provided code and dates', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue(null);
        (prisma.coupon.create as any).mockResolvedValue({ id: 'coupon-1', name: 'VIP' });

        const req = new Request('http://localhost/api/admin/coupons', {
            method: 'POST',
            body: JSON.stringify({
                name: 'VIP Fevereiro',
                type: 'PERCENT',
                value: 10,
                active: true,
                bindEmail: '  vip@example.com  ',
                code: '  VIP10  ',
                startsAt: ' 2026-08-27T00:00:00.000Z ',
                endsAt: ' 2026-09-27T00:00:00.000Z ',
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.coupon.id).toBe('coupon-1');
        expect(data.createdCode).toBe('VIP10');
        expect(prisma.coupon.create).toHaveBeenCalledTimes(1);
        expect(prisma.coupon.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                name: 'VIP Fevereiro',
                type: 'PERCENT',
                bindEmail: 'vip@example.com',
                startsAt: new Date('2026-08-27T00:00:00.000Z'),
                endsAt: new Date('2026-09-27T00:00:00.000Z'),
            }),
        }));
    });

    it('normalizes string arrays and trims coupon inputs', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue(null);
        (prisma.coupon.create as any).mockResolvedValue({ id: 'coupon-2', name: 'Férias' });

        const req = new Request('http://localhost/api/admin/coupons', {
            method: 'POST',
            body: JSON.stringify({
                name: '  Férias  ',
                type: ' fixed ',
                value: ' 50 ',
                code: '  ferias50  ',
                allowedRoomTypeIds: [' room-1 ', ' ', 'room-2'],
                allowedSources: [' direct ', null, 'whatsapp '],
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(201);
        expect(prisma.coupon.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                name: 'Férias',
                type: ' FIXED ',
                allowedRoomTypeIds: JSON.stringify(['room-1', 'room-2']),
                allowedSources: JSON.stringify(['direct', 'whatsapp']),
            }),
        }));
    });

    it('rejects invalid coupon payload', async () => {
        const req = new Request('http://localhost/api/admin/coupons', {
            method: 'POST',
            body: JSON.stringify({
                name: '',
                type: 'PERCENT',
                value: 10,
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('Nome obrigatorio');
    });
});
