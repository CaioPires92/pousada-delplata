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
        process.env.ADMIN_JWT_SECRET = 'test-secret-at-least-32-characters-long';
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
                name: '  Atualizado  ',
                type: '  PERCENT  ',
                value: 15,
                bindEmail: '  VIP@EXAMPLE.COM  ',
                bindPhone: ' (55) 19 99999-0000 ',
            }),
        });

        const res = await PUT(req as any, { params: Promise.resolve({ id: 'coupon-1' }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.coupon.id).toBe('coupon-1');
        expect(prisma.coupon.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                name: 'Atualizado',
                type: 'PERCENT',
                bindEmail: 'vip@example.com',
                bindPhone: '5519999990000',
            }),
        }));
    });

    it('returns updatedCode when code is changed manually', async () => {
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
                code: 'VIP15',
            }),
        });

        const res = await PUT(req as any, { params: Promise.resolve({ id: 'coupon-1' }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.updatedCode).toBe('VIP15');
    });

    it('normalizes whitespace and arrays when updating coupon data', async () => {
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
                name: '  Atualizado  ',
                type: '  percent  ',
                value: ' 15 ',
                code: '  vip15  ',
                startsAt: ' 2026-08-27T00:00:00.000Z ',
                endsAt: ' 2026-09-27T00:00:00.000Z ',
                allowedRoomTypeIds: [' room-1 ', 'room-2 '],
                allowedSources: [' direct ', ' whatsapp '],
            }),
        });

        const res = await PUT(req as any, { params: Promise.resolve({ id: 'coupon-1' }) });

        expect(res.status).toBe(200);
        expect(prisma.coupon.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                name: 'Atualizado',
                type: 'PERCENT',
                codeHash: expect.any(String),
                codePrefix: 'VIP15',
                startsAt: new Date('2026-08-27T00:00:00.000Z'),
                endsAt: new Date('2026-09-27T00:00:00.000Z'),
                allowedRoomTypeIds: JSON.stringify(['room-1', 'room-2']),
                allowedSources: JSON.stringify(['direct', 'whatsapp']),
            }),
        }));
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
