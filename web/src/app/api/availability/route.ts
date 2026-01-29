import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { assertDayKey, compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';

// Force dynamic rendering - don't try to build this route at build time
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults');
    const children = searchParams.get('children');

    if (!checkIn || !checkOut) {
        return NextResponse.json(
            { error: 'Check-in and check-out dates are required' },
            { status: 400 }
        );
    }

    const totalGuests = (parseInt(adults || '0') + parseInt(children || '0')) || 1;
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
                capacity: {
                    gte: totalGuests,
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
            let totalPrice = 0;

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
                    totalPrice += Number(rate.price);
                } else {
                    totalPrice += Number(room.basePrice);
                }
            }

            if (isAvailable) {
                availableRooms.push({
                    ...room,
                    totalPrice,
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
