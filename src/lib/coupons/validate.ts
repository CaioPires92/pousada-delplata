import prisma from '@/lib/prisma';
import { calculateCouponDiscount } from '@/lib/coupons/discount';
import { hashCouponCode, normalizeCouponCode, normalizeGuestEmail, normalizeGuestPhone } from '@/lib/coupons/hash';
import { CouponValidationInput, CouponValidationResult } from '@/lib/coupons/types';

function parseStringArray(raw?: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((v) => String(v || '').trim())
                .filter(Boolean);
        }
    } catch {
        return [];
    }
    return [];
}

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

    const normalizedEmail = normalizeGuestEmail(input.guestEmail);
    const normalizedPhone = normalizeGuestPhone(input.guestPhone);

    if (coupon.bindEmail && normalizedEmail !== normalizeGuestEmail(coupon.bindEmail)) {
        return { valid: false, reason: 'GUEST_NOT_ELIGIBLE', couponId: coupon.id };
    }

    if (coupon.bindPhone && normalizedPhone !== normalizeGuestPhone(coupon.bindPhone)) {
        return { valid: false, reason: 'GUEST_NOT_ELIGIBLE', couponId: coupon.id };
    }

    const allowedRoomTypeIds = parseStringArray(coupon.allowedRoomTypeIds);
    if (allowedRoomTypeIds.length > 0) {
        if (!input.roomTypeId || !allowedRoomTypeIds.includes(input.roomTypeId)) {
            return { valid: false, reason: 'ROOM_NOT_ELIGIBLE', couponId: coupon.id };
        }
    }

    const allowedSources = parseStringArray(coupon.allowedSources).map((s) => s.toLowerCase());
    if (allowedSources.length > 0) {
        const source = String(input.source || '').trim().toLowerCase();
        if (!source || !allowedSources.includes(source)) {
            return { valid: false, reason: 'SOURCE_NOT_ELIGIBLE', couponId: coupon.id };
        }
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

    if (coupon.maxUsesPerGuest !== null && normalizedEmail) {
        const guestConfirmedCount = await prisma.couponRedemption.count({
            where: {
                couponId: coupon.id,
                status: 'CONFIRMED',
                guestEmail: normalizedEmail,
            },
        });

        if (guestConfirmedCount >= coupon.maxUsesPerGuest) {
            return { valid: false, reason: 'GUEST_USAGE_LIMIT_REACHED', couponId: coupon.id };
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