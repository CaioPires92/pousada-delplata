import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { requireAdminAuth } from '@/lib/admin-auth';
import { normalizeDateStr } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
    const auth = await requireAdminAuth();
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const roomTypeId = searchParams.get('roomTypeId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!roomTypeId || !startDateParam || !endDateParam) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Preparação das datas para o Prisma (Objetos Date com meio-dia para evitar timezone shift)
    const start = new Date(`${startDateParam}T12:00:00Z`);
    const end = new Date(`${endDateParam}T12:00:00Z`);

    try {
        // 1. Buscar detalhes do quarto
        const roomType = await prisma.roomType.findUnique({
            where: { id: roomTypeId }
        });

        if (!roomType) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // 2. Buscar Tarifas (Rates) - Usando o novo tipo DateTime
        const rates = await prisma.rate.findMany({
            where: {
                roomTypeId,
                startDate: { lte: end },
                endDate: { gte: start }
            },
            orderBy: { createdAt: 'desc' }
        });

        const normalizedRates = rates.map((r) => {
            const sDay = r.startDate instanceof Date ? r.startDate.toISOString().split('T')[0] : String(r.startDate).slice(0, 10);
            const eDay = r.endDate instanceof Date ? r.endDate.toISOString().split('T')[0] : String(r.endDate).slice(0, 10);
            return {
                ...r,
                dayStart: sDay,
                dayEnd: eDay,
                __validDayRange: true
            };
        });

        // 3. Buscar Ajustes de Inventário
        const inventoryAdjustments = await prisma.inventoryAdjustment.findMany({
            where: {
                roomTypeId,
                date: { gte: start, lte: end }
            }
        });

        // Mapeia usando a chave string YYYY-MM-DD para o frontend encontrar fácil
        const inventoryByDay = new Map(
            inventoryAdjustments.map((row) => [
                row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).slice(0, 10),
                row
            ])
        );

        // 4. Buscar Reservas Ativas (Substituindo o $queryRaw por findMany seguro)
        const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);

        const activeBookings = await prisma.booking.findMany({
            where: {
                roomTypeId,
                status: { in: ['CONFIRMED', 'PAID', 'PENDING'] },
                OR: [
                    { status: { in: ['CONFIRMED', 'PAID'] } },
                    {
                        AND: [
                            { status: 'PENDING' },
                            { createdAt: { gte: new Date(Date.now() - ttlMinutes * 60000) } }
                        ]
                    }
                ],
                // Filtro de sobreposição
                checkIn: { lte: end },
                checkOut: { gt: start }
            }
        });

        const bookingsCountByDay = new Map<string, number>();
        for (const b of activeBookings) {
            const bIn = b.checkIn.toISOString().split('T')[0];
            const bOut = b.checkOut.toISOString().split('T')[0];

            const rangeStart = compareDayKey(bIn, startDateParam) < 0 ? startDateParam : bIn;
            const endInclusive = prevDayKey(bOut);
            const rangeEnd = compareDayKey(endInclusive, endDateParam) > 0 ? endDateParam : endInclusive;

            if (compareDayKey(rangeStart, rangeEnd) <= 0) {
                for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                    bookingsCountByDay.set(dayKey, (bookingsCountByDay.get(dayKey) || 0) + 1);
                }
            }
        }

        // 5. Unificar dados por dia para o Calendário
        const dayKeys = eachDayKeyInclusive(startDateParam, endDateParam);

        const calendarData = dayKeys.map((dateStr) => {
            const rate = normalizedRates.find((r) => dateStr >= r.dayStart && dateStr <= r.dayEnd);
            const adjustment = inventoryByDay.get(dateStr);
            const totalInventory = adjustment ? adjustment.totalUnits : roomType.totalUnits;
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
        console.error('[Admin Calendar] ERROR:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}