import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { assertDayKey, compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { BookingPriceError, calculateBookingPrice } from '@/lib/booking-price';

// Force dynamic rendering - don't try to build this route at build time
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults');
    const children = searchParams.get('children');
    const childrenAgesParam = searchParams.get('childrenAges');

    if (!checkIn || !checkOut) {
        return NextResponse.json(
            { error: 'Check-in and check-out dates are required' },
            { status: 400 }
        );
    }

    const adultsCount = Number.parseInt(adults || '0', 10) || 0;
    const childrenCount = Number.parseInt(children || '0', 10) || 0;
    const childrenAges =
        typeof childrenAgesParam === 'string' && childrenAgesParam.trim().length > 0
            ? childrenAgesParam
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .map((s) => Number.parseInt(s, 10))
            : [];

    if (childrenCount !== childrenAges.length) {
        return NextResponse.json(
            { error: 'missing_children_ages' },
            { status: 400 }
        );
    }

    if (childrenAges.some((age) => !Number.isFinite(age) || age < 0 || age > 17)) {
        return NextResponse.json(
            { error: 'invalid_children_ages' },
            { status: 400 }
        );
    }

    const adultsFromChildren = childrenAges.filter((age) => age >= 12).length;
    const childrenUnder12 = childrenAges.filter((age) => age < 12).length;
    const effectiveAdults = adultsCount + adultsFromChildren;
    const effectiveGuests = effectiveAdults + childrenUnder12;

    if (effectiveAdults < 1) {
        return NextResponse.json(
            { error: 'min_1_adult' },
            { status: 400 }
        );
    }
    try {
        assertDayKey(checkIn, 'checkIn');
        assertDayKey(checkOut, 'checkOut');
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Invalid date format. Use YYYY-MM-DD' },
            { status: 400 }
        );
    }

    if (compareDayKey(checkIn, checkOut) >= 0) {
        return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
    }

    const lastNight = prevDayKey(checkOut);
    const nights = eachDayKeyInclusive(checkIn, lastNight);
    const stayLength = nights.length;

    // Basic validation
    if (stayLength <= 0) {
        return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
    }

    try {
        // 1. Get all room types that can accommodate the guests
        const roomTypes = await prisma.roomType.findMany({
            where: {
                maxGuests: {
                    gte: effectiveGuests,
                },
            },
            include: {
                photos: true,
                rates: {
                    where: {
                        startDate: { lte: checkOut },
                        endDate: { gte: checkIn },
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                },
                inventory: {
                    where: {
                        date: { gte: checkIn, lte: lastNight },
                    },
                },
            },
        });

        // 2. Filter rooms based on availability
        const availableRooms = [];
        const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);
        const pendingModifier = `-${ttlMinutes} minutes`;

        for (const room of roomTypes) {
            let isAvailable = true;
            let baseTotalForStay = 0;

            // --- Validation: Check-in Rules (CTA & MinLOS) ---
            // Find rate for check-in date
            const checkInRate = room.rates.find((r: any) => checkIn >= r.startDate && checkIn <= r.endDate);

            if (checkInRate) {
                if (checkInRate.cta) {
                    isAvailable = false; // Closed to Arrival
                }
                if (stayLength < checkInRate.minLos) {
                    isAvailable = false; // Minimum Length of Stay not met
                }
            }
            if (!isAvailable) continue; // Skip room if check-in rules fail

            // --- Validation: Check-out Rules (CTD) ---
            // Find rate for check-out date (note: we check availability for NIGHTS, but CTD applies to the check-out day itself)
            // Need to fetch rate covering checkOut date specifically? 
            // The query above fetches rates overlapping [startDate, endDate], so checkOut IS included in fetched rates.
            const checkOutRate = room.rates.find((r: any) => checkOut >= r.startDate && checkOut <= r.endDate);

            if (checkOutRate && checkOutRate.ctd) {
                isAvailable = false; // Closed to Departure
                continue;
            }

            const bookingRows = await prisma.$queryRaw<{ checkInDay: string; checkOutDay: string }[]>`
                SELECT substr(checkIn, 1, 10) as checkInDay, substr(checkOut, 1, 10) as checkOutDay
                FROM Booking
                WHERE roomTypeId = ${room.id}
                  AND (
                    status IN ('CONFIRMED', 'PAID')
                    OR (status = 'PENDING' AND createdAt >= datetime('now', ${pendingModifier}))
                  )
                  AND substr(checkIn, 1, 10) <= ${lastNight}
                  AND substr(checkOut, 1, 10) > ${checkIn}
            `;
            const bookingsCountByDay = new Map<string, number>();
            for (const b of bookingRows) {
                const checkInDay = b.checkInDay;
                const checkOutDay = b.checkOutDay;
                if (!checkInDay || !checkOutDay) continue;

                const rangeStart = compareDayKey(checkInDay, checkIn) < 0 ? checkIn : checkInDay;
                const endInclusive = prevDayKey(checkOutDay);
                const rangeEnd = compareDayKey(endInclusive, lastNight) > 0 ? lastNight : endInclusive;
                if (compareDayKey(rangeStart, rangeEnd) > 0) continue;

                for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                    bookingsCountByDay.set(dayKey, (bookingsCountByDay.get(dayKey) || 0) + 1);
                }
            }

            // --- Validation: Daily Rules (Inventory & StopSell) ---
            for (const night of nights) {
                // Find rate for this night
                const rate = room.rates.find((r: any) => night >= r.startDate && night <= r.endDate);

                // Check Stop Sell (Closed)
                if (rate && rate.stopSell) {
                    isAvailable = false;
                    break;
                }

                // Check inventory (Bookings count)
                const bookingsCount = bookingsCountByDay.get(night) || 0;

                const dailyInventory = room.inventory.find((i: any) => i.date === night);
                const maxUnits = dailyInventory ? dailyInventory.totalUnits : room.totalUnits;

                if (bookingsCount >= maxUnits) {
                    isAvailable = false;
                    break;
                }

                // Calculate Price
                if (rate) {
                    baseTotalForStay += Number(rate.price);
                } else {
                    baseTotalForStay += Number(room.basePrice);
                }
            }

            if (isAvailable) {
                let breakdown;
                try {
                    breakdown = calculateBookingPrice({
                        nights: stayLength,
                        baseTotalForStay,
                        adults: adultsCount,
                        childrenAges,
                        includedAdults: (room as any).includedAdults,
                        maxGuests: (room as any).maxGuests,
                        extraAdultFee: Number((room as any).extraAdultFee ?? 0),
                        child6To11Fee: Number((room as any).child6To11Fee ?? 0),
                    });
                } catch (e) {
                    if (e instanceof BookingPriceError) continue;
                    throw e;
                }

                availableRooms.push({
                    ...room,
                    totalPrice: breakdown.total,
                    priceBreakdown: breakdown,
                });
            }
        }

        return NextResponse.json(availableRooms);
    } catch (error) {
        console.error('Error checking availability:', error);
        return NextResponse.json(
            { error: 'Error checking availability' },
            { status: 500 }
        );
    }
}
