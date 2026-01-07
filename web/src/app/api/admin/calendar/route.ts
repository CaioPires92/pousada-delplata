import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eachDayOfInterval, format, startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const roomTypeId = searchParams.get('roomTypeId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!roomTypeId || !startDateStr || !endDateStr) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);

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
                startDate: { lte: end },
                endDate: { gte: start }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // 3. Fetch Inventory Overrides
        const inventoryAdjustments = await prisma.inventoryAdjustment.findMany({
            where: {
                roomTypeId,
                date: {
                    gte: start,
                    lte: end
                }
            }
        });

        // 4. Fetch Bookings (Active only)
        const bookings = await prisma.booking.findMany({
            where: {
                roomTypeId,
                status: { in: ['CONFIRMED', 'PAID', 'PENDING'] },
                checkIn: { lte: end },
                checkOut: { gt: start }
            },
            select: {
                checkIn: true,
                checkOut: true
            }
        });

        // 5. Merge Data per Day
        const days = eachDayOfInterval({ start, end });
        
        const calendarData = days.map(day => {
            // Fix: Use UTC Date String to avoid timezone shift
            const dateStr = day.toISOString().split('T')[0];
            const dayTime = day.getTime();

            // --- Rate ---
            // Find specific rate for this day
            const rate = rates.find(r => {
                const rStart = new Date(r.startDate).toISOString().split('T')[0];
                const rEnd = new Date(r.endDate).toISOString().split('T')[0];
                return dateStr >= rStart && dateStr <= rEnd;
            });

            // --- Inventory ---
            // Fix: Compare dates using yyyy-MM-dd string to ignore time/timezone differences
            const adjustment = inventoryAdjustments.find(i => {
                const adjDate = i.date.toISOString().split('T')[0];
                return adjDate === dateStr;
            });
            const totalInventory = adjustment ? adjustment.totalUnits : roomType.totalUnits;

            // --- Bookings Count ---
            const bookingsCount = bookings.filter(b => {
                const bCheckIn = new Date(b.checkIn).setHours(0,0,0,0);
                const bCheckOut = new Date(b.checkOut).setHours(0,0,0,0);
                return dayTime >= bCheckIn && dayTime < bCheckOut;
            }).length;

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
        console.error('Error fetching calendar data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
