import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { GET } from './route';
import { requireAdminAuth } from '@/lib/admin-auth';

vi.mock('@/lib/prisma', () => ({
    default: {
        couponAttemptLog: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(),
}));

describe('Admin Coupon Attempts API /api/admin/coupons/attempts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (requireAdminAuth as any).mockResolvedValue({ sub: 'admin-1', email: 'admin@example.com' });
    });

    it('returns recent attempts when authenticated', async () => {
        (prisma.couponAttemptLog.findMany as any).mockResolvedValue([
            { id: 'a1', result: 'INVALID', reason: 'INVALID_CODE' },
        ]);

        const req = new Request('http://localhost/api/admin/coupons/attempts');
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.total).toBe(1);
        expect(data.attempts[0].id).toBe('a1');
        expect(prisma.couponAttemptLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 50 })
        );
    });

    it('applies filters from query params', async () => {
        (prisma.couponAttemptLog.findMany as any).mockResolvedValue([]);

        const req = new Request(
            'http://localhost/api/admin/coupons/attempts?limit=20&result=invalid&reason=too_many_attempts&codePrefix=vip&days=7'
        );
        const res = await GET(req);

        expect(res.status).toBe(200);

        const args = (prisma.couponAttemptLog.findMany as any).mock.calls[0][0];
        expect(args.take).toBe(20);
        expect(args.where.result).toBe('INVALID');
        expect(args.where.reason).toBe('TOO_MANY_ATTEMPTS');
        expect(args.where.codePrefix.startsWith).toBe('VIP');
        expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    });

    it('returns auth response when unauthorized', async () => {
        (requireAdminAuth as any).mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const req = new Request('http://localhost/api/admin/coupons/attempts');
        const res = await GET(req);

        expect(res.status).toBe(401);
    });
});
