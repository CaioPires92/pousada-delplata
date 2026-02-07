import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateBookingPrice } from '@/lib/booking-price';
import { eachDayKeyInclusive } from '@/lib/day-key';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const checkIn = searchParams.get('checkIn');
        const checkOut = searchParams.get('checkOut');
        const adultsCount = parseInt(searchParams.get('adults') || '2', 10);
        const childrenAges = searchParams.get('childrenAges')?.split(',').map(Number) || [];

        if (!checkIn || !checkOut) {
            return NextResponse.json({ error: 'Check-in e check-out são obrigatórios' }, { status: 400 });
        }

        const stayLength = Math.ceil(
            (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (stayLength <= 0) return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });

        const daysSelected = eachDayKeyInclusive(checkIn, checkOut);
        const nightStrings = daysSelected.slice(0, -1);

        const roomTypes = await prisma.roomType.findMany({
            include: {
                photos: { orderBy: { position: 'asc' } },
                rates: true
            }
        });

        const availableRooms = [];
        let minRequiredAcrossRooms = Infinity;
        let eligibleMinLosCount = 0;
        const vinteMinutosAtras = new Date(Date.now() - 20 * 60 * 1000);

        for (const room of roomTypes) {
            // --- TRAVA ANTI-OVERBOOKING (CONTAGE DE UNIDADES) ---
            const reservasOcupando = await prisma.booking.count({
                where: {
                    roomTypeId: room.id,
                    checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
                    checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
                    OR: [
                        { status: 'CONFIRMED' },
                        {
                            status: 'PENDING',
                            createdAt: { gte: vinteMinutosAtras }
                        }
                    ]
                }
            });

            // Só pula se todas as unidades do tipo de quarto estiverem ocupadas
            if (reservasOcupando >= (room.totalUnits || 1)) continue;

            const rates = room.rates.map((r: any) => ({
                ...r,
                startDate: r.startDate instanceof Date ? r.startDate : new Date(`${String(r.startDate)}T00:00:00Z`),
                endDate: r.endDate instanceof Date ? r.endDate : new Date(`${String(r.endDate)}T00:00:00Z`),
            }));

            const adjustments = await prisma.inventoryAdjustment.findMany({
                where: { roomTypeId: room.id, dateKey: { in: nightStrings } },
            });

            const adjustmentByDay = new Map(
                adjustments.map((adj) => [adj.dateKey, adj.totalUnits])
            );

            const effectiveTotalUnits = nightStrings.reduce((min, dayKey) => {
                const dayUnits = adjustmentByDay.has(dayKey)
                    ? Number(adjustmentByDay.get(dayKey))
                    : Number(room.totalUnits || 1);
                return Math.min(min, dayUnits);
            }, Number(room.totalUnits || 1));

            if (effectiveTotalUnits <= 0) continue;

            let baseTotalForStay = 0;
            let requiredMinLos = 1;
            for (const dayStr of nightStrings) {
                const specificRate = rates.find(r => {
                    const rStart = r.startDate.toISOString().split('T')[0];
                    const rEnd = r.endDate.toISOString().split('T')[0];
                    return dayStr >= rStart && dayStr <= rEnd;
                });
                baseTotalForStay += specificRate ? Number(specificRate.price) : Number(room.basePrice);
                const dayMinLos = specificRate ? Number(specificRate.minLos) : 1;
                if (dayMinLos > requiredMinLos) requiredMinLos = dayMinLos;
            }

            if (requiredMinLos < minRequiredAcrossRooms) {
                minRequiredAcrossRooms = requiredMinLos;
            }
            if (stayLength < requiredMinLos) continue;
            eligibleMinLosCount += 1;

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

                const remainingUnits = effectiveTotalUnits - reservasOcupando;
                if (remainingUnits <= 0) continue;

                availableRooms.push({
                    ...room,
                    totalPrice: breakdown.total,
                    priceBreakdown: breakdown,
                    isAvailable: true,
                    remainingUnits,
                    minLos: requiredMinLos
                });
            } catch { }
        }

        if (availableRooms.length === 0 && eligibleMinLosCount === 0 && Number.isFinite(minRequiredAcrossRooms)) {
            return NextResponse.json({ error: 'min_stay_required', minLos: minRequiredAcrossRooms }, { status: 400 });
        }

        return NextResponse.json(availableRooms);
    } catch {
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
