import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { GET } from './route';
import { requireAdminAuth } from '@/lib/admin-auth';

vi.mock('@/lib/prisma', () => ({
    default: {
        coupon: { count: vi.fn() },
        couponRedemption: { count: vi.fn() },
        couponAttemptLog: { count: vi.fn() },
    },
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(),
}));

describe('Admin Coupon Metrics API /api/admin/coupons/metrics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns metrics when authenticated', async () => {
        (requireAdminAuth as any).mockResolvedValue({ sub: 'admin-1' });

        const couponCountMock = prisma.coupon.count as any;
        couponCountMock
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(9);

        const redemptionCountMock = prisma.couponRedemption.count as any;
        redemptionCountMock
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(17)
            .mockResolvedValueOnce(5);

        const attemptCountMock = prisma.couponAttemptLog.count as any;
        attemptCountMock
            .mockResolvedValueOnce(14)
            .mockResolvedValueOnce(4)
            .mockResolvedValueOnce(23)
            .mockResolvedValueOnce(45)
            .mockResolvedValueOnce(11)
            .mockResolvedValueOnce(80);

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.inventory.totalCoupons).toBe(12);
        expect(data.inventory.activeCoupons).toBe(9);
        expect(data.redemptions.confirmed).toBe(17);
        expect(data.attempts.last7d.invalid).toBe(14);
        expect(data.attempts.last30d.valid).toBe(80);
    });

    it('returns auth response when unauthorized', async () => {
        (requireAdminAuth as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        );

        const res = await GET();

        expect(res.status).toBe(401);
    });
});
