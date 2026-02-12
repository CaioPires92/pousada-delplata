import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCouponCodePrefix, hashTelemetryValue, normalizeGuestEmail } from '@/lib/coupons/hash';
import { reserveCouponUsage } from '@/lib/coupons/reservation';
import { shouldThrottleCouponRequest } from '@/lib/coupons/rate-limit';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const code = String(body?.code || '');
        const guestEmail = String(body?.guest?.email || '');
        const guestPhone = String(body?.guest?.phone || '');
        const roomTypeId = String(body?.context?.roomTypeId || '');
        const source = String(body?.context?.source || 'direct');
        const subtotal = Number(body?.context?.subtotal);

        if (shouldThrottleCouponRequest({ scope: 'reserve', request, guestEmail })) {
            return NextResponse.json({ valid: false, reason: 'TOO_MANY_ATTEMPTS' }, { status: 429 });
        }

        if (!Number.isFinite(subtotal)) {
            return NextResponse.json({ valid: false, reason: 'MISSING_SUBTOTAL' }, { status: 400 });
        }

        const result = await reserveCouponUsage({
            code,
            subtotal,
            guestEmail,
            guestPhone,
            roomTypeId,
            source,
        });

        const forwardedFor = request.headers.get('x-forwarded-for') || '';
        const ip = forwardedFor.split(',')[0]?.trim() || null;
        const ua = request.headers.get('user-agent') || null;

        await prisma.couponAttemptLog.create({
            data: {
                couponId: result.couponId || null,
                codePrefix: getCouponCodePrefix(code),
                guestEmail: normalizeGuestEmail(guestEmail) || null,
                ipHash: ip ? hashTelemetryValue(ip) : null,
                userAgentHash: ua ? hashTelemetryValue(ua) : null,
                result: result.valid ? 'VALID' : 'INVALID',
                reason: result.reason,
            },
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('[Coupon Reserve] ERROR:', error);
        return NextResponse.json(
            { valid: false, reason: 'INVALID_COUPON_CONFIG', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}

