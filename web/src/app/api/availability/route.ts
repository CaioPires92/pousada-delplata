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
            return NextResponse.json({ error: 'Check-in e check-out são obrigatórios' }, { status: 400 });
        }

        const stayLength = Math.ceil(
            (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (stayLength <= 0) return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });

        const daysSelected = eachDayKeyInclusive(checkIn, checkOut);
        const nightStrings = daysSelected.slice(0, -1);
        const nightObjects = nightStrings.map(d => new Date(`${d}T00:00:00Z`));

        const roomTypes = await prisma.roomType.findMany({
            include: {
                photos: { orderBy: { position: 'asc' } },
                rates: true
            }
        });

        const availableRooms = [];
        const vinteMinutosAtras = new Date(Date.now() - 20 * 60 * 1000);

        for (const room of roomTypes) {
            // --- NOVA TRAVA ANTI-OVERBOOKING ---
            const reservaAtiva = await prisma.booking.findFirst({
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

            if (reservaAtiva) continue;

            const rates = room.rates.map((r: any) => ({
                ...r,
                startDate: r.startDate instanceof Date ? r.startDate : new Date(`${String(r.startDate)}T00:00:00Z`),
                endDate: r.endDate instanceof Date ? r.endDate : new Date(`${String(r.endDate)}T00:00:00Z`),
            }));

            const adjustments = await prisma.inventoryAdjustment.findMany({
                where: { roomTypeId: room.id, date: { in: nightObjects } },
            });

            if (adjustments.some((adj) => adj.totalUnits === 0)) continue;

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
                    isAvailable: true
                });
            } catch (e) { }
        }

        return NextResponse.json(availableRooms);
    } catch (error) {
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}