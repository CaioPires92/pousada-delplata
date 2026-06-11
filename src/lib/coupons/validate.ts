import prisma from '@/lib/prisma';
import { calculateCouponDiscount } from '@/lib/coupons/discount';
import { hashCouponCode, normalizeCouponCode } from '@/lib/coupons/hash';
import { CouponValidationInput, CouponValidationResult } from '@/lib/coupons/types';

export async function validateCoupon(input: CouponValidationInput): Promise<CouponValidationResult> {
    const now = input.now ?? new Date();
    const code = normalizeCouponCode(input.code);

    if (!Number.isFinite(input.subtotal)) {
        return { valid: false, reason: 'MISSING_SUBTOTAL' };
    }

    if (!code) {
        return { valid: false, reason: 'INVALID_CODE' };
    }

    const subtotal = Number(input.subtotal);
    const codeHash = hashCouponCode(code);

    const coupon = await prisma.coupon.findFirst({
        where: { codeHash },
    });

    if (!coupon) {
        return { valid: false, reason: 'INVALID_CODE' };
    }

    if (!coupon.active) {
        return { valid: false, reason: 'INACTIVE', couponId: coupon.id };
    }

    if (coupon.startsAt && now < coupon.startsAt) {
        return { valid: false, reason: 'NOT_STARTED', couponId: coupon.id };
    }

    if (coupon.endsAt && now > coupon.endsAt) {
        return { valid: false, reason: 'EXPIRED', couponId: coupon.id };
    }



    if (coupon.minBookingValue !== null && subtotal < Number(coupon.minBookingValue)) {
        return { valid: false, reason: 'MIN_BOOKING_NOT_REACHED', couponId: coupon.id };
    }

    if (coupon.maxGlobalUses !== null) {
        const globalConfirmedCount = await prisma.couponRedemption.count({
            where: {
                couponId: coupon.id,
                status: 'CONFIRMED',
            },
        });

        if (globalConfirmedCount >= coupon.maxGlobalUses) {
            return { valid: false, reason: 'USAGE_LIMIT_REACHED', couponId: coupon.id };
        }
    }



    const couponType = String(coupon.type || '').toUpperCase();
    if (couponType !== 'PERCENT' && couponType !== 'FIXED') {
        return { valid: false, reason: 'INVALID_COUPON_CONFIG', couponId: coupon.id };
    }

    const couponValue = Number(coupon.value);
    if (!Number.isFinite(couponValue) || couponValue <= 0) {
        return { valid: false, reason: 'INVALID_COUPON_CONFIG', couponId: coupon.id };
    }

    const discount = calculateCouponDiscount({
        couponType,
        couponValue,
        subtotal,
        maxDiscountAmount: coupon.maxDiscountAmount === null ? undefined : Number(coupon.maxDiscountAmount),
    });

    return {
        valid: true,
        reason: 'OK',
        couponId: coupon.id,
        couponType,
        couponValue,
        discountAmount: discount.amount,
        subtotal,
        total: discount.total,
    };
}