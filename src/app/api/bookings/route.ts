import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { calculateBookingPrice } from '@/lib/booking-price';
import { parseLocalDate } from '@/lib/date-utils';
import { hashCouponCode, normalizeCouponCode, normalizeGuestEmail } from '@/lib/coupons/hash';
import { compareDayKey } from '@/lib/day-key';
import { getEffectiveGuestCounts, requiresFourGuestInventory } from '@/lib/guest-capacity';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomTypeId, checkIn, checkOut, guest, adults, childrenAges } = body;
        const adultsCount = Math.max(1, Number.parseInt(String(adults ?? 1), 10) || 1);
        const childrenCount = Math.max(0, Number.parseInt(String(body?.children ?? 0), 10) || 0);

        if (!roomTypeId || !checkIn || !checkOut || !guest || !guest.email) {
            return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
        }

        const agesArrayInput = Array.isArray(childrenAges)
            ? childrenAges
                .map((age) => Number.parseInt(String(age), 10))
                .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17)
            : [];
        const requestedGuestCounts = getEffectiveGuestCounts({
            adults: adultsCount,
            childrenAges: agesArrayInput,
        });
        const serializedChildrenAges = agesArrayInput.length > 0 ? JSON.stringify(agesArrayInput) : null;

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
            const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);
            const pendingThreshold = new Date(Date.now() - ttlMinutes * 60 * 1000);
            const activeBookings = await tx.booking.findMany({
                where: {
                    roomTypeId,
                    checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
                    checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
                    OR: [
                        { status: { in: ['CONFIRMED', 'PAID'] } },
                        { status: 'PENDING', createdAt: { gte: pendingThreshold } },
                    ],
                },
                select: {
                    checkIn: true,
                    checkOut: true,
                    adults: true,
                    childrenAges: true,
                },
            });
            const adjustments = await tx.inventoryAdjustment.findMany({
                where: { roomTypeId, dateKey: { in: nightKeys } },
            });
            const fourGuestAdjustments = await tx.fourGuestInventoryAdjustment.findMany({
                where: { roomTypeId, dateKey: { in: nightKeys } },
            });

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

            const bookingsCountByDay = new Map<string, number>();
            const bookingsFor4GuestsByDay = new Map<string, number>();
            const firstNight = nightKeys[0];
            const lastNight = nightKeys[nightKeys.length - 1];

            for (const booking of activeBookings) {
                const bookingStart = booking.checkIn.toISOString().split('T')[0];
                const bookingEndExclusive = booking.checkOut.toISOString().split('T')[0];
                const bookingEndInclusive = prevDayKey(bookingEndExclusive);
                const bookingGuestCounts = getEffectiveGuestCounts({
                    adults: booking.adults,
                    childrenAges: booking.childrenAges,
                });
                const usesFourGuestInventory = requiresFourGuestInventory(bookingGuestCounts.effectiveGuests);

                const rangeStart = compareDayKey(bookingStart, firstNight) < 0 ? firstNight : bookingStart;
                const rangeEnd = compareDayKey(bookingEndInclusive, lastNight) > 0 ? lastNight : bookingEndInclusive;
                if (compareDayKey(rangeStart, rangeEnd) > 0) continue;

                for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                    bookingsCountByDay.set(dayKey, (bookingsCountByDay.get(dayKey) || 0) + 1);
                    if (usesFourGuestInventory) {
                        bookingsFor4GuestsByDay.set(dayKey, (bookingsFor4GuestsByDay.get(dayKey) || 0) + 1);
                    }
                }
            }

            const adjustmentByDay = new Map(adjustments.map((adj) => [adj.dateKey, adj.totalUnits]));
            const fourGuestAdjustmentByDay = new Map(fourGuestAdjustments.map((adj) => [adj.dateKey, adj.totalUnits]));
            const capacityTotal = Number(roomType.totalUnits || 1);
            const inventoryFor4Guests = Math.max(
                0,
                Math.min(capacityTotal, Number((roomType as { inventoryFor4Guests?: number | null }).inventoryFor4Guests || 0))
            );
            const effectiveSellableUnits = nightKeys.reduce((min, dayKey) => {
                const adjustedValue = adjustmentByDay.has(dayKey)
                    ? Number(adjustmentByDay.get(dayKey))
                    : null;
                const bookingsCount = bookingsCountByDay.get(dayKey) || 0;
                const dayTotalUnits = adjustedValue !== null
                    ? Math.max(0, Math.min(capacityTotal, adjustedValue))
                    : capacityTotal;
                const daySellableUnits = Math.max(0, dayTotalUnits - bookingsCount);

                return Math.min(min, daySellableUnits);
            }, Number.POSITIVE_INFINITY);

            if (!Number.isFinite(effectiveSellableUnits) || effectiveSellableUnits <= 0) {
                throw new Error('room_unavailable');
            }

            if (requiresFourGuestInventory(requestedGuestCounts.effectiveGuests)) {
                const effectiveSellableUnitsFor4Guests = nightKeys.reduce((min, dayKey) => {
                const bookedFor4Guests = bookingsFor4GuestsByDay.get(dayKey) || 0;
                const adjustedFor4Guests = fourGuestAdjustmentByDay.has(dayKey)
                    ? Number(fourGuestAdjustmentByDay.get(dayKey))
                    : null;
                const remainingUnitsFor4Guests = adjustedFor4Guests !== null
                        ? Math.max(0, Math.min(inventoryFor4Guests, adjustedFor4Guests) - bookedFor4Guests)
                        : Math.max(0, inventoryFor4Guests - bookedFor4Guests);
                return Math.min(min, remainingUnitsFor4Guests);
            }, Number.POSITIVE_INFINITY);

                if (!Number.isFinite(effectiveSellableUnitsFor4Guests) || effectiveSellableUnitsFor4Guests <= 0) {
                    throw new Error('room_unavailable');
                }
            }

            const breakdown = calculateBookingPrice({
                nights: nightKeys.length,
                baseTotalForStay: baseTotalForStay,
                adults: adultsCount,
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
                    adults: adultsCount,
                    children: childrenCount,
                    childrenAges: serializedChildrenAges,
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
        if (error?.message === 'room_unavailable') {
            return NextResponse.json({ error: 'room_unavailable' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}



