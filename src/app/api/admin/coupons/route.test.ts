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
        (requireAdminAuth as any).mockResolvedValue({ sub: 'admin-1', email: 'admin@example.com' });
    });

    it('returns coupons when authenticated', async () => {
        (prisma.coupon.findMany as any).mockResolvedValue([{ id: 'c1', name: 'VIP' }]);

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual([{ id: 'c1', name: 'VIP' }]);
    });

    it('returns auth response when unauthorized', async () => {
        (requireAdminAuth as any).mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const res = await GET();

        expect(res.status).toBe(401);
    });

    it('creates coupon with generated code', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue(null);
        (prisma.coupon.create as any).mockResolvedValue({ id: 'coupon-1', name: 'VIP' });

        const req = new Request('http://localhost/api/admin/coupons', {
            method: 'POST',
            body: JSON.stringify({
                name: 'VIP Fevereiro',
                type: 'PERCENT',
                value: 10,
                generateCode: true,
                active: true,
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.coupon.id).toBe('coupon-1');
        expect(typeof data.createdCode).toBe('string');
        expect(data.createdCode.length).toBe(10);
        expect(prisma.coupon.create).toHaveBeenCalledTimes(1);
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
