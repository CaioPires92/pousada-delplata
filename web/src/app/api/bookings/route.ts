import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';
import { assertDayKey, compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { parseLocalDate } from '@/lib/date-utils';
import { BookingPriceError, calculateBookingPrice } from '@/lib/booking-price';

export async function POST(request: Request) {
    let ctxRoomTypeId: string | undefined;
    let ctxCheckIn: string | undefined;
    let ctxCheckOut: string | undefined;
    try {
        const body = await request.json();
        const { roomTypeId, checkIn, checkOut, guest, adults, children, childrenAges, totalPrice } = body;
        ctxRoomTypeId = roomTypeId;
        ctxCheckIn = checkIn;
        ctxCheckOut = checkOut;

        // 1. Validate input
        if (!roomTypeId || !checkIn || !checkOut || !guest) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const adultsCount = Number.parseInt(String(adults ?? ''), 10);
        const childrenCount = Number.parseInt(String(children ?? ''), 10);
        const agesArray = Array.isArray(childrenAges) ? childrenAges : [];
        const normalizedChildrenAges = agesArray.map((age) => Number.parseInt(String(age), 10));

        if (!Number.isFinite(adultsCount) || adultsCount < 0) {
            return NextResponse.json({ error: 'invalid_adults' }, { status: 400 });
        }

        if (!Number.isFinite(childrenCount) || childrenCount < 0) {
            return NextResponse.json({ error: 'invalid_children' }, { status: 400 });
        }

        if (childrenCount !== normalizedChildrenAges.length) {
            return NextResponse.json({ error: 'missing_children_ages' }, { status: 400 });
        }

        if (normalizedChildrenAges.some((age) => !Number.isFinite(age) || age < 0 || age > 17)) {
            return NextResponse.json({ error: 'invalid_children_ages' }, { status: 400 });
        }

        const booking = await prisma.$transaction(async (tx) => {
            const roomType = await tx.roomType.findUnique({
                where: { id: roomTypeId },
                include: {
                    rates: {
                        where: {
                            startDate: { lte: checkOut },
                            endDate: { gte: checkIn },
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
            if (!roomType) return null;

            try {
                assertDayKey(checkIn, 'checkIn');
                assertDayKey(checkOut, 'checkOut');
            } catch {
                throw new Error('Invalid dates');
            }
            if (compareDayKey(checkIn, checkOut) >= 0) {
                throw new Error('Invalid dates');
            }

            const startDayKey = checkIn;
            const endDayExclusiveKey = checkOut;
            const lastNightKey = prevDayKey(endDayExclusiveKey);
            const nightKeys = eachDayKeyInclusive(startDayKey, lastNightKey);
            const nightsCount = nightKeys.length;

            const inventoryAdjustments = await tx.inventoryAdjustment.findMany({
                where: {
                    roomTypeId,
                    date: { gte: startDayKey, lt: endDayExclusiveKey },
                },
            });
            const inventoryByDay = new Map(
                inventoryAdjustments.map((row) => [row.date, row.totalUnits])
            );

            const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);
            const pendingModifier = `-${ttlMinutes} minutes`;
            const overlappingBookings = await tx.$queryRaw<{ checkInDay: string; checkOutDay: string }[]>`
                SELECT substr(checkIn, 1, 10) as checkInDay, substr(checkOut, 1, 10) as checkOutDay
                FROM Booking
                WHERE roomTypeId = ${roomTypeId}
                  AND (
                    status NOT IN ('CANCELLED', 'PENDING')
                    OR (status = 'PENDING' AND createdAt >= datetime('now', ${pendingModifier}))
                  )
                  AND substr(checkIn, 1, 10) < ${endDayExclusiveKey}
                  AND substr(checkOut, 1, 10) > ${startDayKey}
            `;

            const bookedCountByDay = new Map<string, number>();
            for (const b of overlappingBookings) {
                const bStart = b.checkInDay;
                const bEndExclusive = b.checkOutDay;
                if (!bStart || !bEndExclusive) continue;

                const rangeStart = compareDayKey(bStart, startDayKey) < 0 ? startDayKey : bStart;
                const endInclusive = prevDayKey(bEndExclusive);
                const rangeEnd = compareDayKey(endInclusive, lastNightKey) > 0 ? lastNightKey : endInclusive;
                if (compareDayKey(rangeStart, rangeEnd) > 0) continue;

                for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                    bookedCountByDay.set(dayKey, (bookedCountByDay.get(dayKey) || 0) + 1);
                }
            }

            for (const key of eachDayKeyInclusive(startDayKey, lastNightKey)) {
                const totalUnitsForDay = inventoryByDay.get(key) ?? roomType.totalUnits;
                const booked = bookedCountByDay.get(key) || 0;
                if (booked >= totalUnitsForDay) {
                    throw new Error('No availability');
                }
            }

            let baseTotalForStay = 0;
            for (const night of nightKeys) {
                const rate = (roomType as any).rates?.find((r: any) => night >= r.startDate && night <= r.endDate);
                baseTotalForStay += rate ? Number(rate.price) : Number((roomType as any).basePrice);
            }

            let breakdown;
            try {
                breakdown = calculateBookingPrice({
                    nights: nightsCount,
                    baseTotalForStay,
                    adults: adultsCount,
                    childrenAges: normalizedChildrenAges,
                    includedAdults: (roomType as any).includedAdults,
                    maxGuests: (roomType as any).maxGuests,
                    extraAdultFee: Number((roomType as any).extraAdultFee ?? 0),
                    child6To11Fee: Number((roomType as any).child6To11Fee ?? 0),
                });
            } catch (e) {
                if (e instanceof BookingPriceError) throw e;
                throw e;
            }

            const guestRecord = await tx.guest.create({
                data: {
                    name: guest.name,
                    email: guest.email,
                    phone: guest.phone,
                },
            });

            return tx.booking.create({
                data: {
                    roomTypeId,
                    guestId: guestRecord.id,
                    checkIn: parseLocalDate(checkIn),
                    checkOut: parseLocalDate(checkOut),
                    totalPrice: breakdown.total,
                    status: 'PENDING',
                },
            });
        });

        if (!booking) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // 4. (Optional) Create Payment Preference here if integrating Mercado Pago immediately
        // For now, we just return the booking to proceed to payment step

        opsLog('info', 'BOOKING_CREATED', {
            bookingId: booking.id,
            roomTypeId: ctxRoomTypeId,
            checkIn: ctxCheckIn,
            checkOut: ctxCheckOut,
            adults: adultsCount,
            children: childrenCount,
            quotedTotalPrice: typeof totalPrice === 'number' ? totalPrice : undefined,
        });
        return NextResponse.json(booking, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'No availability') {
            opsLog('warn', 'BOOKING_NO_AVAILABILITY', {
                roomTypeId: ctxRoomTypeId,
                checkIn: ctxCheckIn,
                checkOut: ctxCheckOut,
            });
            return NextResponse.json({ error: 'Sem disponibilidade para o período selecionado' }, { status: 409 });
        }
        if (error instanceof Error && error.message === 'Invalid dates') {
            opsLog('warn', 'BOOKING_INVALID_DATES', {
                roomTypeId: ctxRoomTypeId,
                checkIn: ctxCheckIn,
                checkOut: ctxCheckOut,
            });
            return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 });
        }
        if (error instanceof BookingPriceError) {
            const status = error.code === 'capacity_exceeded' ? 409 : 400;
            return NextResponse.json({ error: error.code }, { status });
        }
        Sentry.captureException(error);
        opsLog('error', 'BOOKING_CREATE_ERROR', {
            roomTypeId: ctxRoomTypeId,
            checkIn: ctxCheckIn,
            checkOut: ctxCheckOut,
        });
        return NextResponse.json(
            { error: 'Error creating booking' },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Admin only - list all bookings
    // In a real app, add auth check here
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const bookings = await prisma.booking.findMany({
            include: {
                guest: true,
                roomType: true,
                payment: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return NextResponse.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return NextResponse.json({ error: 'Error fetching bookings' }, { status: 500 });
    }
}
