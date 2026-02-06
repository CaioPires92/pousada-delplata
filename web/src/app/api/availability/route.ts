import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateBookingPrice, BookingPriceError } from '@/lib/booking-price';
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
            return NextResponse.json({ error: 'Check-in and check-out are required' }, { status: 400 });
        }

        const stayLength = Math.ceil(
            (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (stayLength <= 0) return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });

        const roomTypes = await prisma.roomType.findMany({
            include: {
                photos: { orderBy: { position: 'asc' } },
                rates: true // Importante: carrega todas as regras de Stop Sell e Preço
            }
        });

        // --- CORREÇÃO DE ESCOPO: Declaramos a variável aqui em cima ---
        const daysSelected = eachDayKeyInclusive(checkIn, checkOut);

        // Agora o console.log não dará erro
        console.log("Dias sendo validados para Stop Sell:", daysSelected);

        // Dias para cálculo de preço e inventário (exclui o dia do checkout)
        const nightStrings = daysSelected.slice(0, -1);
        const nightObjects = nightStrings.map(d => new Date(`${d}T00:00:00Z`));

        const availableRooms = [];

        for (const room of roomTypes) {
            const rates = room.rates.map((r: any) => ({
                ...r,
                startDate: r.startDate instanceof Date ? r.startDate : new Date(`${String(r.startDate)}T00:00:00Z`),
                endDate: r.endDate instanceof Date ? r.endDate : new Date(`${String(r.endDate)}T00:00:00Z`),
            }));
            // --- 1. VALIDAÇÃO DE INVENTÁRIO (Quartos físicos) ---
            const adjustments = await prisma.inventoryAdjustment.findMany({
                where: {
                    roomTypeId: room.id,
                    date: { in: nightObjects },
                },
            });

            const isSoldOut = adjustments.some((adj) => adj.totalUnits === 0);
            if (isSoldOut) continue;

            // --- 2. VALIDAÇÃO DE REGRAS (MinLos) ---

            // Validação de Mínimo de Noites baseada no check-in
            const activeRate = rates.find(r => {
                const rStart = r.startDate.toISOString().split('T')[0];
                const rEnd = r.endDate.toISOString().split('T')[0];
                return checkIn >= rStart && checkIn <= rEnd;
            });

            if (stayLength < (activeRate?.minLos || 1)) {
                console.log(`[MinLos] ${room.name} exige mais noites.`);
                continue;
            }

            // --- 3. CÁLCULO DE PREÇO ---
            let baseTotalForStay = 0;
            for (const dayStr of nightStrings) {
                const specificRate = rates.find(r => {
                    const rStart = r.startDate.toISOString().split('T')[0];
                    const rEnd = r.endDate.toISOString().split('T')[0];
                    return dayStr >= rStart && dayStr <= rEnd;
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

                availableRooms.push({
                    ...room,
                    totalPrice: breakdown.total,
                    priceBreakdown: breakdown,
                    isAvailable: true
                });
            } catch (e) {
                if (!(e instanceof BookingPriceError && e.code === 'capacity_exceeded')) {
                    console.error(`[Pricing Error] ${room.name}:`, e);
                }
            }
        }

        return NextResponse.json(availableRooms);
    } catch (error) {
        console.error('[Availability API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
