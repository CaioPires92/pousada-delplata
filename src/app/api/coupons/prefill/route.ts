import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashCouponCode, normalizeCouponCode } from '@/lib/coupons/hash';
import { shouldThrottleCouponRequest } from '@/lib/coupons/rate-limit';

export const runtime = 'nodejs';

const PRIVATE_RESPONSE_HEADERS = {
    'Cache-Control': 'private, no-store, max-age=0',
};

export async function POST(request: Request) {
    try {
        if (shouldThrottleCouponRequest({ scope: 'prefill', request })) {
            return NextResponse.json(
                { available: false, reason: 'TOO_MANY_ATTEMPTS' },
                { status: 429, headers: PRIVATE_RESPONSE_HEADERS }
            );
        }

        const body = await request.json().catch(() => ({}));
        const code = normalizeCouponCode(String(body?.code || ''));
        if (!code) {
            return NextResponse.json(
                { available: false },
                { status: 200, headers: PRIVATE_RESPONSE_HEADERS }
            );
        }

        const coupon = await prisma.coupon.findFirst({
            where: { codeHash: hashCouponCode(code) },
            select: {
                active: true,
                startsAt: true,
                endsAt: true,
                bindEmail: true,
                bindPhone: true,
                originBooking: {
                    select: {
                        guest: {
                            select: {
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                },
            },
        });

        const now = new Date();
        const isEligible = Boolean(
            coupon
            && coupon.active
            && (!coupon.startsAt || coupon.startsAt <= now)
            && (!coupon.endsAt || coupon.endsAt >= now)
            && (coupon.bindEmail || coupon.bindPhone)
            && coupon.originBooking?.guest
        );

        if (!isEligible || !coupon?.originBooking?.guest) {
            return NextResponse.json(
                { available: false },
                { status: 200, headers: PRIVATE_RESPONSE_HEADERS }
            );
        }

        return NextResponse.json(
            {
                available: true,
                guest: coupon.originBooking.guest,
            },
            { status: 200, headers: PRIVATE_RESPONSE_HEADERS }
        );
    } catch (error) {
        console.error('[Coupon Prefill] Error:', error);
        return NextResponse.json(
            { available: false },
            { status: 500, headers: PRIVATE_RESPONSE_HEADERS }
        );
    }
}
