import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { reserveCouponUsage, releaseCouponReservation } from '@/lib/coupons/reservation';
import { validateCoupon } from '@/lib/coupons/validate';

vi.mock('@/lib/prisma', () => ({
    default: {
        $transaction: vi.fn(),
        coupon: {
            findUnique: vi.fn(),
        },
        couponRedemption: {
            updateMany: vi.fn(),
            count: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock('@/lib/coupons/validate', () => ({
    validateCoupon: vi.fn(),
}));

describe('coupon reservation service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a reservation when coupon is valid', async () => {
        (validateCoupon as any).mockResolvedValue({
            valid: true,
            reason: 'OK',
            couponId: 'coupon-1',
            discountAmount: 50,
            subtotal: 200,
            total: 150,
        });

        const tx = {
            couponRedemption: {
                updateMany: vi.fn().mockResolvedValue({ count: 0 }),
                count: vi.fn().mockResolvedValue(0),
                findFirst: vi.fn().mockResolvedValue(null),
                create: vi.fn().mockResolvedValue({
                    id: 'res-1',
                    expiresAt: new Date('2026-02-11T10:15:00.000Z'),
                }),
            },
            coupon: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 'coupon-1',
                    maxGlobalUses: null,
                    maxUsesPerGuest: null,
                    singleUse: true,
                }),
            },
        };

        (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));

        const result = await reserveCouponUsage({
            code: ' vip10 ',
            subtotal: 200,
            guestEmail: 'Guest@Email.com',
            guestPhone: '(11) 99999-9999',
            source: 'direct',
            roomTypeId: 'room-1',
            now: new Date('2026-02-11T10:00:00.000Z'),
        });

        expect(result.valid).toBe(true);
        expect(result.reservationId).toBe('res-1');
        expect(result.reservationExpiresAt).toBe('2026-02-11T10:15:00.000Z');
        expect(tx.couponRedemption.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    couponId: 'coupon-1',
                    status: 'RESERVED',
                    guestEmail: 'guest@email.com',
                    guestPhone: '11999999999',
                    discountAmount: 50,
                }),
            })
        );
    });

    it('reuses existing active reservation for single-use coupon', async () => {
        (validateCoupon as any).mockResolvedValue({
            valid: true,
            reason: 'OK',
            couponId: 'coupon-1',
            discountAmount: 50,
            subtotal: 200,
            total: 150,
        });

        const tx = {
            couponRedemption: {
                updateMany: vi.fn().mockResolvedValue({ count: 0 }),
                count: vi.fn().mockResolvedValue(0),
                findFirst: vi.fn().mockResolvedValue({
                    id: 'res-existing',
                    expiresAt: new Date('2026-02-11T10:15:00.000Z'),
                }),
                create: vi.fn(),
            },
            coupon: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 'coupon-1',
                    maxGlobalUses: null,
                    maxUsesPerGuest: null,
                    singleUse: true,
                }),
            },
        };

        (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(tx));

        const result = await reserveCouponUsage({
            code: 'VIP10',
            subtotal: 200,
            guestEmail: 'guest@email.com',
            now: new Date('2026-02-11T10:00:00.000Z'),
        });

        expect(result.valid).toBe(true);
        expect(result.reservationId).toBe('res-existing');
        expect(tx.couponRedemption.create).not.toHaveBeenCalled();
    });

    it('releases an active reservation by id and guest email', async () => {
        (prisma.couponRedemption.updateMany as any).mockResolvedValue({ count: 1 });

        const result = await releaseCouponReservation({
            reservationId: 'res-1',
            guestEmail: 'Guest@Email.com',
        });

        expect(result).toEqual({ released: true });
        expect(prisma.couponRedemption.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 'res-1',
                    guestEmail: 'guest@email.com',
                }),
                data: expect.objectContaining({
                    status: 'RELEASED',
                }),
            })
        );
    });
});
