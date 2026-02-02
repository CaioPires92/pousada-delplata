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

        const start = new Date(`${checkIn}T00:00:00Z`);
        const end = new Date(`${checkOut}T00:00:00Z`);
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
            return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });
        }
        const stayLength = diffDays;

        // 1. Buscar todos os tipos de quarto
        const roomTypes = await prisma.roomType.findMany({
            include: {
                photos: {
                    orderBy: { position: 'asc' } // Ajustado de 'order' para 'position'
                }
            }
        });

        const availableRooms = [];

        for (const room of roomTypes) {
            // 2. Buscar tarifas para o período
            const rates = await prisma.rate.findMany({
                where: {
                    roomTypeId: room.id,
                    startDate: { lte: end },
                    endDate: { gte: start }
                }
            });

            // 3. Calcular preço base somando as diárias individuais
            let baseTotalForStay = 0;
            const days = eachDayKeyInclusive(checkIn, checkOut).slice(0, -1); // remove o dia do checkout

            for (const dayKey of days) {
                const dayDate = new Date(`${dayKey}T00:00:00Z`);
                const specificRate = rates.find(r => dayDate >= r.startDate && dayDate <= r.endDate);
                baseTotalForStay += specificRate ? Number(specificRate.price) : Number(room.basePrice);
            }

            // 4. Calcular Preço Final com Taxas (Ajuste aqui)
            try {
                const breakdown = calculateBookingPrice({
                    nights: stayLength,
                    baseTotalForStay,
                    adults: adultsCount,
                    childrenAges,
                    // Garantimos que os valores venham do banco convertidos para número
                    includedAdults: Number(room.includedAdults ?? 2),
                    maxGuests: Number(room.maxGuests),
                    extraAdultFee: Number(room.extraAdultFee || 0),
                    child6To11Fee: Number(room.child6To11Fee || 0),
                });

                availableRooms.push({
                    ...room,
                    totalPrice: breakdown.total,
                    priceBreakdown: breakdown,
                    isAvailable: true // Simplificado para este exemplo
                });
            } catch (e) {
                if (e instanceof BookingPriceError && e.code === 'capacity_exceeded') {
                    continue; // Pula quartos que não cabem os hóspedes
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
