import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { calculateBookingPrice } from '@/lib/booking-price';
import { parseLocalDate } from '@/lib/date-utils';
import { hashCouponCode, normalizeCouponCode, normalizeGuestEmail } from '@/lib/coupons/hash';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomTypeId, checkIn, checkOut, guest, adults, childrenAges } = body;

        if (!roomTypeId || !checkIn || !checkOut || !guest || !guest.email) {
            return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
        }

        const agesArrayInput = Array.isArray(childrenAges) ? childrenAges : [];

        const couponReservationId =
            typeof body?.coupon?.reservationId === 'string' ? body.coupon.reservationId.trim() : '';
        const couponCode = typeof body?.coupon?.code === 'string' ? body.coupon.code : '';

        const booking = await prisma.$transaction(async (tx) => {
            const roomType = await tx.roomType.findUnique({
                where: { id: roomTypeId },
                include: {
                    rates: {
                        where: {
                            startDate: { lte: new Date(`${checkOut}T00:00:00Z`) },
                            endDate: { gte: new Date(`${checkIn}T00:00:00Z`) },
                        },
                    },
                },
            });

            if (!roomType) return null;

            const nightKeys = eachDayKeyInclusive(checkIn, prevDayKey(checkOut));

            let baseTotalForStay = 0;
            let requiredMinLos = 1;
            for (const night of nightKeys) {
                const rate = roomType.rates.find(r => {
                    const rStart = r.startDate.toISOString().split('T')[0];
                    const rEnd = r.endDate.toISOString().split('T')[0];
                    return night >= rStart && night <= rEnd;
                });
                baseTotalForStay += rate ? Number(rate.price) : Number(roomType.basePrice);
                const dayMinLos = rate ? Number(rate.minLos) : 1;
                if (dayMinLos > requiredMinLos) requiredMinLos = dayMinLos;
            }

            if (nightKeys.length < requiredMinLos) {
                throw new Error(`min_stay_required:${requiredMinLos}`);
            }

            const breakdown = calculateBookingPrice({
                nights: nightKeys.length,
                baseTotalForStay: baseTotalForStay,
                adults: Number(adults),
                childrenAges: agesArrayInput,
                includedAdults: Number(roomType.includedAdults),
                maxGuests: Number(roomType.maxGuests),
                extraAdultFee: Number(roomType.extraAdultFee),
                child6To11Fee: Number(roomType.child6To11Fee),
            });

            let guestRecord = await tx.guest.findFirst({
                where: { email: guest.email }
            });

            if (guestRecord) {
                guestRecord = await tx.guest.update({
                    where: { id: guestRecord.id },
                    data: { name: guest.name, phone: guest.phone }
                });
            } else {
                guestRecord = await tx.guest.create({
                    data: { name: guest.name, email: guest.email, phone: guest.phone }
                });
            }

            const subtotalPrice = Number(breakdown.total);
            let discountAmount = 0;
            let appliedCouponCode: string | null = null;
            const now = new Date();

            if (couponReservationId) {
                const reservation = await tx.couponRedemption.findUnique({
                    where: { id: couponReservationId },
                    include: { coupon: true },
                });

                if (!reservation || !reservation.coupon) {
                    throw new Error('coupon_reservation_not_found');
                }

                if (reservation.status !== 'RESERVED' || reservation.bookingId) {
                    throw new Error('coupon_reservation_unavailable');
                }

                if (reservation.expiresAt && reservation.expiresAt <= now) {
                    throw new Error('coupon_reservation_expired');
                }

                const normalizedGuestEmail = normalizeGuestEmail(guest.email);
                if (!normalizedGuestEmail) {
                    throw new Error('coupon_guest_email_required');
                }

                if (reservation.guestEmail && reservation.guestEmail !== normalizedGuestEmail) {
                    throw new Error('coupon_guest_mismatch');
                }

                const normalizedCouponCode = normalizeCouponCode(couponCode);
                if (normalizedCouponCode) {
                    const expectedHash = hashCouponCode(normalizedCouponCode);
                    if (reservation.coupon.codeHash !== expectedHash) {
                        throw new Error('coupon_code_mismatch');
                    }
                    appliedCouponCode = normalizedCouponCode;
                }

                discountAmount = Math.max(0, Math.min(Number(reservation.discountAmount || 0), subtotalPrice));
            }

            const bookingRecord = await tx.booking.create({
                data: {
                    roomTypeId,
                    guestId: guestRecord.id,
                    checkIn: parseLocalDate(checkIn),
                    checkOut: parseLocalDate(checkOut),
                    subtotalPrice,
                    discountAmount,
                    appliedCouponCode,
                    totalPrice: Math.max(0, subtotalPrice - discountAmount),
                    status: 'PENDING',
                },
                include: {
                    guest: true,
                    roomType: true,
                    payment: true,
                },
            });

            if (couponReservationId) {
                const lock = await tx.couponRedemption.updateMany({
                    where: {
                        id: couponReservationId,
                        status: 'RESERVED',
                        bookingId: null,
                    },
                    data: {
                        bookingId: bookingRecord.id,
                        status: 'CONFIRMED',
                        confirmedAt: now,
                    },
                });

                if (lock.count !== 1) {
                    throw new Error('coupon_reservation_conflict');
                }
            }

            return bookingRecord;
        });
        if (!booking) return NextResponse.json({ error: 'Quarto não encontrado' }, { status: 404 });

        return NextResponse.json(booking, { status: 201 });

    } catch (error: any) {
        console.error('[Booking API Error]:', error);
        if (typeof error?.message === 'string' && error.message.startsWith('min_stay_required:')) {
            const minLos = error.message.split(':')[1] || '1';
            return NextResponse.json({ error: 'min_stay_required', minLos: Number(minLos) }, { status: 400 });
        }
        if (typeof error?.message === 'string' && error.message.startsWith('coupon_')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}



