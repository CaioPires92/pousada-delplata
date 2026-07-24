import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { __resetCouponRateLimitForTests } from '@/lib/coupons/rate-limit';
import { POST } from './route';

vi.mock('@/lib/prisma', () => ({
    default: {
        coupon: {
            findFirst: vi.fn(),
        },
    },
}));

describe('POST /api/coupons/prefill', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetCouponRateLimitForTests();
    });

    it('returns guest data for an active individual coupon', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            active: true,
            startsAt: null,
            endsAt: new Date(Date.now() + 60_000),
            bindEmail: 'caio@example.com',
            bindPhone: '19998701203',
            originBooking: {
                guest: {
                    name: 'Caio Pires',
                    email: 'caio@example.com',
                    phone: '19998701203',
                },
            },
        });

        const response = await POST(new Request('http://localhost/api/coupons/prefill', {
            method: 'POST',
            body: JSON.stringify({ code: 'VOLTE-TESTE123' }),
        }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toContain('no-store');
        expect(data).toEqual({
            available: true,
            guest: {
                name: 'Caio Pires',
                email: 'caio@example.com',
                phone: '19998701203',
            },
        });
    });

    it('does not expose guest data for a public coupon', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            active: true,
            startsAt: null,
            endsAt: null,
            bindEmail: null,
            bindPhone: null,
            originBooking: null,
        });

        const response = await POST(new Request('http://localhost/api/coupons/prefill', {
            method: 'POST',
            body: JSON.stringify({ code: 'PUBLIC10' }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ available: false });
    });

    it('does not expose guest data for an expired coupon', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            active: true,
            startsAt: null,
            endsAt: new Date(Date.now() - 60_000),
            bindEmail: 'caio@example.com',
            bindPhone: null,
            originBooking: {
                guest: {
                    name: 'Caio Pires',
                    email: 'caio@example.com',
                    phone: '19998701203',
                },
            },
        });

        const response = await POST(new Request('http://localhost/api/coupons/prefill', {
            method: 'POST',
            body: JSON.stringify({ code: 'EXPIRED10' }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ available: false });
    });
});
