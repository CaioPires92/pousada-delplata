import prisma from '@/lib/prisma';
import { calculateCouponDiscount } from '@/lib/coupons/discount';
import { hashCouponCode, normalizeCouponCode, normalizeGuestEmail, normalizeGuestPhone } from '@/lib/coupons/hash';
import { CouponValidationInput, CouponValidationResult } from '@/lib/coupons/types';
import { stayOverlapsBlockedRange } from '@/lib/discount-policy';
import { getDiscountPolicy } from '@/lib/discount-policy-store';

type CouponPolicyFields = {
    bindEmail?: string | null;
    bindPhone?: string | null;
    allowedRoomTypeIds?: unknown;
    allowedSources?: unknown;
    maxUsesPerGuest?: number | null;
};

function parseList(value: unknown) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item).trim()).filter(Boolean);
            }
        } catch {
            // Fall back to comma-separated values below.
        }
        return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

export async function validateCoupon(input: CouponValidationInput): Promise<CouponValidationResult> {
    const now = input.now ?? new Date();
    const code = normalizeCouponCode(input.code);
    const guestEmail = normalizeGuestEmail(input.guestEmail);
    const guestPhone = normalizeGuestPhone(input.guestPhone);
    const source = String(input.source || '').trim().toLowerCase();
    const roomTypeId = String(input.roomTypeId || '').trim();

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

    const blockedDateRanges = input.blockedDateRanges ?? (await getDiscountPolicy()).blockedDateRanges;
    if (stayOverlapsBlockedRange({
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        blockedDateRanges,
    })) {
        return { valid: false, reason: 'STAY_DATE_BLOCKED', couponId: coupon.id };
    }

    const policy = coupon as typeof coupon & CouponPolicyFields;
    const bindEmail = normalizeGuestEmail(policy.bindEmail);
    if (bindEmail && bindEmail !== guestEmail) {
        return { valid: false, reason: 'GUEST_NOT_ELIGIBLE', couponId: coupon.id };
    }

    const bindPhone = normalizeGuestPhone(policy.bindPhone);
    if (bindPhone && bindPhone !== guestPhone) {
        return { valid: false, reason: 'GUEST_NOT_ELIGIBLE', couponId: coupon.id };
    }

    const allowedRoomTypeIds = parseList(policy.allowedRoomTypeIds);
    if (allowedRoomTypeIds.length > 0 && !allowedRoomTypeIds.includes(roomTypeId)) {
        return { valid: false, reason: 'GUEST_NOT_ELIGIBLE', couponId: coupon.id };
    }

    const allowedSources = parseList(policy.allowedSources).map((item) => item.toLowerCase());
    if (allowedSources.length > 0 && !allowedSources.includes(source)) {
        return { valid: false, reason: 'GUEST_NOT_ELIGIBLE', couponId: coupon.id };
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


    if (policy.maxUsesPerGuest !== null && policy.maxUsesPerGuest !== undefined && (guestEmail || guestPhone)) {
        const perGuestConfirmedCount = await prisma.couponRedemption.count({
            where: {
                couponId: coupon.id,
                status: 'CONFIRMED',
                ...(guestEmail ? { guestEmail } : { guestPhone }),
            },
        });

        if (perGuestConfirmedCount >= policy.maxUsesPerGuest) {
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
