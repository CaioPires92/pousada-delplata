import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateBookingPrice, BookingPriceError } from '@/lib/booking-price';
import { eachDayKeyInclusive } from '@/lib/day-key';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const checkIn = searchParams.get('checkIn');   // "2026-03-08"
        const checkOut = searchParams.get('checkOut'); // "2026-03-10"
        const adultsCount = parseInt(searchParams.get('adults') || '2', 10);
        const childrenAges = searchParams.get('childrenAges')?.split(',').map(Number) || [];

        if (!checkIn || !checkOut) {
            return NextResponse.json({ error: 'Check-in and check-out are required' }, { status: 400 });
        }

        // 1. Cálculos de data usando apenas a parte do dia (YYYY-MM-DD) para evitar problemas de timezone
        const start = new Date(`${checkIn}T00:00:00Z`);
        const end = new Date(`${checkOut}T00:00:00Z`);
        const stayLength = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (stayLength <= 0) return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });

        const roomTypes = await prisma.roomType.findMany({
            include: { photos: { orderBy: { position: 'asc' } } }
        });

        const availableRooms = [];

        for (const room of roomTypes) {
            // --- TRAVA 1: STOP SELL (Inventário) ---
            const adjustments = await prisma.inventoryAdjustment.findMany({
                where: {
                    roomTypeId: room.id,
                    date: { gte: start, lt: end },
                },
            });
            const daysToCheck = eachDayKeyInclusive(checkIn, checkOut).slice(0, -1);
            const isBlocked = daysToCheck.some((dayKey) =>
                adjustments.some(
                    (adj) =>
                        adj.totalUnits === 0 &&
                        adj.date.toISOString().split('T')[0] === dayKey
                )
            );
            if (isBlocked) continue;

            // --- TRAVA 2: MÍNIMO DE DIÁRIAS (minLos) ---
            const rates = await prisma.rate.findMany({
                where: {
                    roomTypeId: room.id,
                    startDate: { lte: end },
                    endDate: { gte: start }
                }
            });

            // Busca a regra específica do dia da entrada (check-in)
            const checkInRate = rates.find(r => {
                const rStart = r.startDate.toISOString().split('T')[0];
                const rEnd = r.endDate.toISOString().split('T')[0];
                return checkIn >= rStart && checkIn <= rEnd;
            });

            const minAllowed = checkInRate?.minLos || 1;
            if (stayLength < minAllowed) continue;

            // 3. Cálculo de Preço
            let baseTotalForStay = 0;
            const days = eachDayKeyInclusive(checkIn, checkOut).slice(0, -1);

            for (const dayKey of days) {
                const specificRate = rates.find(r => {
                    const rStart = r.startDate.toISOString().split('T')[0];
                    const rEnd = r.endDate.toISOString().split('T')[0];
                    return dayKey >= rStart && dayKey <= rEnd;
                });
                baseTotalForStay += specificRate ? Number(specificRate.price) : Number(room.basePrice);
            }

            try {
                const breakdown = calculateBookingPrice({
                    nights: stayLength,
                    baseTotalForStay,
                    adults: adultsCount,
                    childrenAges,
                    includedAdults: Number(room.includedAdults ?? 2),
                    maxGuests: Number(room.maxGuests),
                    extraAdultFee: Number(room.extraAdultFee || 0),
                    child6To11Fee: Number(room.child6To11Fee || 0),
                });

                availableRooms.push({ ...room, totalPrice: breakdown.total, priceBreakdown: breakdown, isAvailable: true });
            } catch (e) {
                if (!(e instanceof BookingPriceError && e.code === 'capacity_exceeded')) console.error(e);
            }
        }

        return NextResponse.json(availableRooms);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
