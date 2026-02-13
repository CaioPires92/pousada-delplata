import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCoupon } from '@/lib/coupons/validate';
import prisma from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
    default: {
        coupon: {
            findFirst: vi.fn(),
        },
        couponRedemption: {
            count: vi.fn(),
        },
    },
}));

describe('validateCoupon', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('validates a percent coupon successfully', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            id: 'coupon-1',
            active: true,
            startsAt: null,
            endsAt: null,
            bindEmail: null,
            bindPhone: null,
            allowedRoomTypeIds: null,
            allowedSources: null,
            minBookingValue: 100,
            maxGlobalUses: 50,
            maxUsesPerGuest: 1,
            type: 'PERCENT',
            value: 10,
            maxDiscountAmount: null,
        });

        (prisma.couponRedemption.count as any).mockImplementation(({ where }: any) => {
            if (where?.guestEmail) return 0;
            return 5;
        });

        const result = await validateCoupon({
            code: ' welcome10 ',
            subtotal: 1000,
            guestEmail: 'john@example.com',
            roomTypeId: 'room-1',
            source: 'direct',
            now: new Date('2026-02-11T10:00:00.000Z'),
        });

        expect(result.valid).toBe(true);
        expect(result.reason).toBe('OK');
        expect(result.discountAmount).toBe(100);
        expect(result.total).toBe(900);
    });

    it('rejects expired coupon', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            id: 'coupon-2',
            active: true,
            startsAt: null,
            endsAt: new Date('2026-02-01T00:00:00.000Z'),
            bindEmail: null,
            bindPhone: null,
            allowedRoomTypeIds: null,
            allowedSources: null,
            minBookingValue: null,
            maxGlobalUses: null,
            maxUsesPerGuest: null,
            type: 'FIXED',
            value: 50,
            maxDiscountAmount: null,
        });

        const result = await validateCoupon({
            code: 'EXPIRED50',
            subtotal: 500,
            now: new Date('2026-02-11T10:00:00.000Z'),
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('EXPIRED');
    });

    it('rejects guest when bindEmail does not match', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            id: 'coupon-3',
            active: true,
            startsAt: null,
            endsAt: null,
            bindEmail: 'vip@hotel.com',
            bindPhone: null,
            allowedRoomTypeIds: null,
            allowedSources: null,
            minBookingValue: null,
            maxGlobalUses: null,
            maxUsesPerGuest: null,
            type: 'PERCENT',
            value: 20,
            maxDiscountAmount: null,
        });

        const result = await validateCoupon({
            code: 'VIP20',
            subtotal: 500,
            guestEmail: 'other@hotel.com',
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('GUEST_NOT_ELIGIBLE');
    });

    it('rejects when minimum booking is not reached', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            id: 'coupon-4',
            active: true,
            startsAt: null,
            endsAt: null,
            bindEmail: null,
            bindPhone: null,
            allowedRoomTypeIds: null,
            allowedSources: null,
            minBookingValue: 1000,
            maxGlobalUses: null,
            maxUsesPerGuest: null,
            type: 'FIXED',
            value: 100,
            maxDiscountAmount: null,
        });

        const result = await validateCoupon({
            code: 'HIGHMIN',
            subtotal: 500,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('MIN_BOOKING_NOT_REACHED');
    });

    it('rejects when global usage limit is reached', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            id: 'coupon-5',
            active: true,
            startsAt: null,
            endsAt: null,
            bindEmail: null,
            bindPhone: null,
            allowedRoomTypeIds: null,
            allowedSources: null,
            minBookingValue: null,
            maxGlobalUses: 2,
            maxUsesPerGuest: null,
            type: 'PERCENT',
            value: 10,
            maxDiscountAmount: null,
        });

        (prisma.couponRedemption.count as any).mockResolvedValue(2);

        const result = await validateCoupon({
            code: 'LIMIT10',
            subtotal: 700,
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('USAGE_LIMIT_REACHED');
    });
});