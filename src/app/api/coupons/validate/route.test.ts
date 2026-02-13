import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';
import { validateCoupon } from '@/lib/coupons/validate';
import { __resetCouponRateLimitForTests } from '@/lib/coupons/rate-limit';

vi.mock('@/lib/prisma', () => ({
    default: {
        couponAttemptLog: {
            create: vi.fn(),
        },
    },
}));

vi.mock('@/lib/coupons/validate', () => ({
    validateCoupon: vi.fn(),
}));

describe('POST /api/coupons/validate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetCouponRateLimitForTests();
    });

    it('returns 400 when subtotal is missing', async () => {
        const req = new Request('http://localhost/api/coupons/validate', {
            method: 'POST',
            body: JSON.stringify({ code: 'WELCOME10', context: {} }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.reason).toBe('MISSING_SUBTOTAL');
    });

    it('returns valid payload and logs attempt', async () => {
        (validateCoupon as any).mockResolvedValue({
            valid: true,
            reason: 'OK',
            couponId: 'coupon-1',
            couponType: 'PERCENT',
            couponValue: 10,
            discountAmount: 100,
            subtotal: 1000,
            total: 900,
        });

        const req = new Request('http://localhost/api/coupons/validate', {
            method: 'POST',
            headers: {
                'x-forwarded-for': '1.2.3.4',
                'user-agent': 'vitest-agent',
            },
            body: JSON.stringify({
                code: 'WELCOME10',
                guest: { email: 'john@example.com' },
                context: { subtotal: 1000, roomTypeId: 'room-1', source: 'direct' },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.valid).toBe(true);
        expect(data.discount.amount).toBe(100);
        expect(prisma.couponAttemptLog.create).toHaveBeenCalledTimes(1);
    });

    it('returns invalid result from validator with HTTP 200', async () => {
        (validateCoupon as any).mockResolvedValue({
            valid: false,
            reason: 'EXPIRED',
        });

        const req = new Request('http://localhost/api/coupons/validate', {
            method: 'POST',
            body: JSON.stringify({
                code: 'EXPIRED50',
                guest: { email: 'john@example.com' },
                context: { subtotal: 500 },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.valid).toBe(false);
        expect(data.reason).toBe('EXPIRED');
    });
    it('returns 429 when validate rate limit is exceeded', async () => {
        (validateCoupon as any).mockResolvedValue({
            valid: false,
            reason: 'INVALID_CODE',
        });

        const payload = {
            code: 'WELCOME10',
            guest: { email: 'john@example.com' },
            context: { subtotal: 1000, roomTypeId: 'room-1', source: 'direct' },
        };

        let lastRes: Response | null = null;
        for (let i = 0; i < 16; i += 1) {
            const req = new Request('http://localhost/api/coupons/validate', {
                method: 'POST',
                headers: {
                    'x-forwarded-for': '1.2.3.4',
                    'user-agent': 'vitest-agent',
                },
                body: JSON.stringify(payload),
            });
            lastRes = await POST(req);
        }

        expect(lastRes).not.toBeNull();
        expect(lastRes?.status).toBe(429);
        const data = await lastRes!.json();
        expect(data.reason).toBe('TOO_MANY_ATTEMPTS');
        expect(prisma.couponAttemptLog.create).toHaveBeenCalled();
    });
});

