import { NextResponse } from 'next/server';
import { releaseCouponReservation } from '@/lib/coupons/reservation';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const reservationId = String(body?.reservationId || '').trim();
        const guestEmail = body?.guest?.email ? String(body.guest.email) : undefined;

        if (!reservationId) {
            return NextResponse.json({ released: false, error: 'reservationId is required' }, { status: 400 });
        }

        const result = await releaseCouponReservation({
            reservationId,
            guestEmail,
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error('[Coupon Release] ERROR:', error);
        return NextResponse.json(
            { released: false, error: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}