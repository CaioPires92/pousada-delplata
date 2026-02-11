import prisma from '@/lib/prisma';
import { normalizeGuestEmail, normalizeGuestPhone } from '@/lib/coupons/hash';
import { validateCoupon } from '@/lib/coupons/validate';
import { CouponValidationInput, CouponValidationResult } from '@/lib/coupons/types';

export type CouponReservationResult = CouponValidationResult & {
    reservationId?: string;
    reservationExpiresAt?: string;
};

function ttlMinutes() {
    const raw = Number(process.env.COUPON_RESERVATION_TTL_MINUTES || '15');
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 15;
}

export async function reserveCouponUsage(input: CouponValidationInput): Promise<CouponReservationResult> {
    const now = input.now ?? new Date();

    const validation = await validateCoupon({ ...input, now });
    if (!validation.valid || !validation.couponId) {
        return validation;
    }

    const guestEmail = normalizeGuestEmail(input.guestEmail) || null;
    const guestPhone = normalizeGuestPhone(input.guestPhone) || null;

    return prisma.$transaction(async (tx) => {
        await tx.couponRedemption.updateMany({
            where: {
                couponId: validation.couponId,
                status: 'RESERVED',
                bookingId: null,
                expiresAt: { lt: now },
            },
            data: {
                status: 'RELEASED',
                releasedAt: now,
            },
        });

        const coupon = await tx.coupon.findUnique({ where: { id: validation.couponId } });
        if (!coupon) {
            return { valid: false, reason: 'INVALID_CODE' };
        }

        const activeReservedFilter: any = {
            couponId: coupon.id,
            status: 'RESERVED',
            bookingId: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        };

        if (coupon.maxGlobalUses !== null) {
            const confirmedCount = await tx.couponRedemption.count({
                where: { couponId: coupon.id, status: 'CONFIRMED' },
            });
            const reservedCount = await tx.couponRedemption.count({ where: activeReservedFilter });

            if (confirmedCount + reservedCount >= coupon.maxGlobalUses) {
                return {
                    valid: false,
                    reason: 'USAGE_LIMIT_REACHED',
                    couponId: coupon.id,
                };
            }
        }

        if (coupon.maxUsesPerGuest !== null && guestEmail) {
            const confirmedGuestCount = await tx.couponRedemption.count({
                where: {
                    couponId: coupon.id,
                    status: 'CONFIRMED',
                    guestEmail,
                },
            });
            const reservedGuestCount = await tx.couponRedemption.count({
                where: {
                    ...activeReservedFilter,
                    guestEmail,
                },
            });

            if (confirmedGuestCount + reservedGuestCount >= coupon.maxUsesPerGuest) {
                return {
                    valid: false,
                    reason: 'GUEST_USAGE_LIMIT_REACHED',
                    couponId: coupon.id,
                };
            }
        }

        if (coupon.singleUse && (guestEmail || guestPhone)) {
            const guestIdentityFilters = [
                ...(guestEmail ? [{ guestEmail }] : []),
                ...(guestPhone ? [{ guestPhone }] : []),
            ];

            const existingReserved = await tx.couponRedemption.findFirst({
                where: {
                    couponId: coupon.id,
                    status: 'RESERVED',
                    bookingId: null,
                    AND: [
                        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                        { OR: guestIdentityFilters },
                    ],
                },
                orderBy: { createdAt: 'desc' },
            });

            if (existingReserved) {
                return {
                    ...validation,
                    reservationId: existingReserved.id,
                    reservationExpiresAt: existingReserved.expiresAt?.toISOString(),
                };
            }
        }

        const expiresAt = new Date(now.getTime() + ttlMinutes() * 60_000);

        const redemption = await tx.couponRedemption.create({
            data: {
                couponId: coupon.id,
                status: 'RESERVED',
                guestEmail,
                guestPhone,
                discountAmount: Number(validation.discountAmount || 0),
                reservedAt: now,
                expiresAt,
            },
        });

        return {
            ...validation,
            reservationId: redemption.id,
            reservationExpiresAt: expiresAt.toISOString(),
        };
    });
}

export async function releaseCouponReservation(input: {
    reservationId: string;
    guestEmail?: string;
    now?: Date;
}) {
    const now = input.now ?? new Date();
    const normalizedGuestEmail = normalizeGuestEmail(input.guestEmail) || null;

    const updated = await prisma.couponRedemption.updateMany({
        where: {
            id: input.reservationId,
            status: 'RESERVED',
            bookingId: null,
            ...(normalizedGuestEmail ? { guestEmail: normalizedGuestEmail } : {}),
        },
        data: {
            status: 'RELEASED',
            releasedAt: now,
        },
    });

    return {
        released: updated.count > 0,
    };
}
