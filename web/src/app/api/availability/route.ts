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

        // Padronização das datas para busca exata no banco (meio-dia UTC para evitar conflitos de fuso)
        const start = new Date(`${checkIn}T12:00:00.000Z`);
        const end = new Date(`${checkOut}T12:00:00.000Z`);

        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
            return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });
        }
        const stayLength = diffDays;

        // 1. Buscar tipos de quarto com fotos
        const roomTypes = await prisma.roomType.findMany({
            include: {
                photos: { orderBy: { position: 'asc' } }
            }
        });

        const availableRooms = [];

        for (const room of roomTypes) {

            // --- TRAVA 1: Inventário e Fechamento (Stop Sell) ---
            // Verifica se existe algum dia no intervalo com totalUnits = 0 no Turso
            const inventoryBlock = await prisma.inventoryAdjustment.findFirst({
                where: {
                    roomTypeId: room.id,
                    date: {
                        gte: new Date(`${checkIn}T00:00:00.000Z`),
                        lt: new Date(`${checkOut}T00:00:00.000Z`)
                    },
                    totalUnits: 0
                }
            });

            if (inventoryBlock) {
                console.log(`[StopSell] Quarto ${room.name} bloqueado para o dia ${inventoryBlock.date}`);
                continue;
            }

            // 2. Buscar tarifas para o período
            const rates = await prisma.rate.findMany({
                where: {
                    roomTypeId: room.id,
                    startDate: { lte: end },
                    endDate: { gte: start }
                }
            });

            // --- TRAVA 2: Mínimo de Diárias (minLos) ---
            // Verifica a regra de permanência mínima para o dia do Check-in
            const checkInRate = rates.find(r => start >= r.startDate && start <= r.endDate);
            const minAllowed = checkInRate?.minLos || 1;

            if (stayLength < minAllowed) {
                console.log(`[MinLos] Quarto ${room.name} exige ${minAllowed} noites, mas a busca foi de ${stayLength}`);
                continue;
            }

            // 3. Calcular preço base somando as diárias individuais
            let baseTotalForStay = 0;
            const days = eachDayKeyInclusive(checkIn, checkOut).slice(0, -1);

            for (const dayKey of days) {
                const dayDate = new Date(`${dayKey}T12:00:00.000Z`);
                const specificRate = rates.find(r => dayDate >= r.startDate && dayDate <= r.endDate);
                baseTotalForStay += specificRate ? Number(specificRate.price) : Number(room.basePrice);
            }

            // 4. Calcular Preço Final com Taxas e Convidados Extras
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
                if (e instanceof BookingPriceError && e.code === 'capacity_exceeded') {
                    continue;
                }
                console.error(`[Availability] Erro no quarto ${room.name}:`, e);
            }
        }

        return NextResponse.json(availableRooms);
    } catch (error) {
        console.error('[Availability API] General Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}