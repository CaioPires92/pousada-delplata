import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { DELETE, PUT } from './route';
import { requireAdminAuth } from '@/lib/admin-auth';

vi.mock('@/lib/prisma', () => ({
    default: {
        coupon: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(),
}));

describe('Admin Coupons API /api/admin/coupons/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (requireAdminAuth as any).mockResolvedValue({ sub: 'admin-1', email: 'admin@example.com' });
    });

    it('updates coupon successfully', async () => {
        (prisma.coupon.findUnique as any).mockResolvedValue({
            id: 'coupon-1',
            active: true,
            singleUse: true,
            stackable: false,
        });
        (prisma.coupon.findFirst as any).mockResolvedValue(null);
        (prisma.coupon.update as any).mockResolvedValue({ id: 'coupon-1', name: 'Atualizado' });

        const req = new Request('http://localhost/api/admin/coupons/coupon-1', {
            method: 'PUT',
            body: JSON.stringify({
                name: 'Atualizado',
                type: 'PERCENT',
                value: 15,
            }),
        });

        const res = await PUT(req as any, { params: Promise.resolve({ id: 'coupon-1' }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.coupon.id).toBe('coupon-1');
    });

    it('returns 409 when updating with duplicate code', async () => {
        (prisma.coupon.findUnique as any).mockResolvedValue({
            id: 'coupon-1',
            active: true,
            singleUse: true,
            stackable: false,
        });
        (prisma.coupon.findFirst as any).mockResolvedValue({ id: 'coupon-2' });

        const req = new Request('http://localhost/api/admin/coupons/coupon-1', {
            method: 'PUT',
            body: JSON.stringify({
                name: 'Atualizado',
                type: 'PERCENT',
                value: 15,
                code: 'VIP15',
            }),
        });

        const res = await PUT(req as any, { params: Promise.resolve({ id: 'coupon-1' }) });

        expect(res.status).toBe(409);
    });

    it('deactivates coupon on delete', async () => {
        (prisma.coupon.update as any).mockResolvedValue({ id: 'coupon-1', active: false });

        const req = new Request('http://localhost/api/admin/coupons/coupon-1', {
            method: 'DELETE',
        });

        const res = await DELETE(req as any, { params: Promise.resolve({ id: 'coupon-1' }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.coupon.active).toBe(false);
        expect(prisma.coupon.update).toHaveBeenCalledTimes(1);
    });
});
