import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { assertDayKey, compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { requireAdminAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
    const auth = await requireAdminAuth();
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const roomTypeId = searchParams.get('roomTypeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!roomTypeId || !startDate || !endDate) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        try {
            assertDayKey(startDate, 'startDate');
            assertDayKey(endDate, 'endDate');
        } catch (e) {
            return NextResponse.json(
                { error: e instanceof Error ? e.message : 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        // 1. Fetch Room Details (Default Capacity)
        const roomType = await prisma.roomType.findUnique({
            where: { id: roomTypeId }
        });

        if (!roomType) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // 2. Fetch Rates
        const rates = await prisma.rate.findMany({
            where: {
                roomTypeId,
                startDate: { lte: endDate },
                endDate: { gte: startDate }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // 3. Fetch Inventory Overrides
        const inventoryAdjustments = await prisma.inventoryAdjustment.findMany({
            where: {
                roomTypeId,
                date: { gte: startDate, lte: endDate }
            }
        });
        const inventoryByDay = new Map(inventoryAdjustments.map((row) => [row.date, row]));

        // 4. Fetch Bookings (Active only)
        const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);
        const pendingModifier = `-${ttlMinutes} minutes`;
        const bookingRows = await prisma.$queryRaw<{ checkInDay: string; checkOutDay: string }[]>`
            SELECT substr(checkIn, 1, 10) as checkInDay, substr(checkOut, 1, 10) as checkOutDay
            FROM Booking
            WHERE roomTypeId = ${roomTypeId}
              AND (
                status IN ('CONFIRMED', 'PAID')
                OR (status = 'PENDING' AND createdAt >= datetime('now', ${pendingModifier}))
              )
              AND substr(checkIn, 1, 10) <= ${endDate}
              AND substr(checkOut, 1, 10) > ${startDate}
        `;
        const bookingsCountByDay = new Map<string, number>();
        for (const b of bookingRows) {
            const checkInDay = b.checkInDay;
            const checkOutDay = b.checkOutDay;
            if (!checkInDay || !checkOutDay) continue;

            const rangeStart = compareDayKey(checkInDay, startDate) < 0 ? startDate : checkInDay;
            const endInclusive = prevDayKey(checkOutDay);
            const rangeEnd = compareDayKey(endInclusive, endDate) > 0 ? endDate : endInclusive;
            if (compareDayKey(rangeStart, rangeEnd) > 0) continue;

            for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                bookingsCountByDay.set(dayKey, (bookingsCountByDay.get(dayKey) || 0) + 1);
            }
        }

        // 5. Merge Data per Day
        const dayKeys = eachDayKeyInclusive(startDate, endDate);

        const calendarData = dayKeys.map((dateStr) => {
            const rate = rates.find((r) => dateStr >= r.startDate && dateStr <= r.endDate);

            // --- Inventory ---
            const adjustment = inventoryByDay.get(dateStr);
            const totalInventory = adjustment ? adjustment.totalUnits : roomType.totalUnits;

            // --- Bookings Count ---
            const bookingsCount = bookingsCountByDay.get(dateStr) || 0;

            const available = Math.max(0, totalInventory - bookingsCount);

            return {
                date: dateStr,
                price: rate ? Number(rate.price) : Number(roomType.basePrice),
                stopSell: rate ? rate.stopSell : false,
                cta: rate ? rate.cta : false,
                ctd: rate ? rate.ctd : false,
                minLos: rate ? rate.minLos : 1,
                rateId: rate ? rate.id : null,
                totalInventory,
                bookingsCount,
                available,
                isAdjusted: !!adjustment
            };
        });

        return NextResponse.json(calendarData);

    } catch (error) {
        const isDev = process.env.NODE_ENV !== 'production';
        const err = error as any;
        const name = typeof err?.name === 'string' ? err.name : 'UnknownError';
        const message = error instanceof Error ? error.message : 'Internal Server Error';

        console.error('[Admin Calendar] ERROR:', { name, message });
        if (isDev) {
            console.error('[Admin Calendar] RAW ERROR:', error);
            if (error instanceof Error && error.stack) {
                console.error('[Admin Calendar] STACK:\n' + error.stack);
            }
        }

        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message,
                ...(isDev
                    ? {
                          details: {
                              name,
                              code: typeof err?.code === 'string' ? err.code : undefined,
                              meta: err?.meta,
                              clientVersion: err?.clientVersion,
                          },
                          stack: error instanceof Error ? error.stack : undefined,
                      }
                    : {}),
            },
            { status: 500 }
        );
    }
}
