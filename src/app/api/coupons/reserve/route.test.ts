import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { POST } from './route';
import { reserveCouponUsage } from '@/lib/coupons/reservation';
import { __resetCouponRateLimitForTests } from '@/lib/coupons/rate-limit';

vi.mock('@/lib/prisma', () => ({
    default: {
        couponAttemptLog: {
            create: vi.fn(),
        },
    },
}));

vi.mock('@/lib/coupons/reservation', () => ({
    reserveCouponUsage: vi.fn(),
}));

describe('POST /api/coupons/reserve', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetCouponRateLimitForTests();
    });

    it('returns 400 when subtotal is missing', async () => {
        const req = new Request('http://localhost/api/coupons/reserve', {
            method: 'POST',
            body: JSON.stringify({ code: 'VIP10' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data).toEqual({ valid: false, reason: 'MISSING_SUBTOTAL' });
    });

    it('reserves coupon and logs telemetry', async () => {
        (reserveCouponUsage as any).mockResolvedValue({
            valid: true,
            reason: 'OK',
            couponId: 'coupon-1',
            discountAmount: 30,
            subtotal: 200,
            total: 170,
            reservationId: 'res-1',
            reservationExpiresAt: '2026-02-11T10:15:00.000Z',
        });

        const req = new Request('http://localhost/api/coupons/reserve', {
            method: 'POST',
            headers: {
                'x-forwarded-for': '177.1.2.3',
                'user-agent': 'Vitest Agent',
            },
            body: JSON.stringify({
                code: 'VIP10',
                guest: { email: 'john@example.com', phone: '11999999999' },
                context: { roomTypeId: 'room-1', source: 'direct', subtotal: 200 },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.valid).toBe(true);
        expect(data.reservationId).toBe('res-1');
        expect(reserveCouponUsage).toHaveBeenCalledTimes(1);
        expect(prisma.couponAttemptLog.create).toHaveBeenCalledTimes(1);
    });

    it('returns 500 on unhandled error', async () => {
        (reserveCouponUsage as any).mockRejectedValue(new Error('boom'));

        const req = new Request('http://localhost/api/coupons/reserve', {
            method: 'POST',
            body: JSON.stringify({
                code: 'VIP10',
                context: { subtotal: 200 },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.valid).toBe(false);
        expect(data.reason).toBe('INVALID_COUPON_CONFIG');
    });
    it('returns 429 when reserve rate limit is exceeded', async () => {
        (reserveCouponUsage as any).mockResolvedValue({
            valid: false,
            reason: 'INVALID_CODE',
        });

        const payload = {
            code: 'VIP10',
            guest: { email: 'john@example.com', phone: '11999999999' },
            context: { roomTypeId: 'room-1', source: 'direct', subtotal: 200 },
        };

        let lastRes: Response | null = null;
        for (let i = 0; i < 9; i += 1) {
            const req = new Request('http://localhost/api/coupons/reserve', {
                method: 'POST',
                headers: {
                    'x-forwarded-for': '177.1.2.3',
                    'user-agent': 'Vitest Agent',
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

