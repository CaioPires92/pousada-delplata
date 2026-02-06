import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { calculateBookingPrice } from '@/lib/booking-price';
import { parseLocalDate } from '@/lib/date-utils';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomTypeId, checkIn, checkOut, guest, adults, childrenAges } = body;

        // 1. Validate input
        if (!roomTypeId || !checkIn || !checkOut || !guest) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const agesArrayInput = Array.isArray(childrenAges) ? childrenAges : [];

        const booking = await prisma.$transaction(async (tx) => {
            const roomType = await tx.roomType.findUnique({
                where: { id: roomTypeId },
                include: {
                    rates: {
                        where: {
                            startDate: { lte: new Date(`${checkOut}T00:00:00Z`) },
                            endDate: { gte: new Date(`${checkIn}T00:00:00Z`) },
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
            if (!roomType) return null;
            const adultsCount = Number.parseInt(String(adults ?? ''), 10);
            const normalizedChildrenAges = agesArrayInput.map((age) => Number.parseInt(String(age), 10));
            const effectiveAdults = Number.isNaN(adultsCount) ? Number(roomType.includedAdults ?? 2) : adultsCount;

            const startDayKey = checkIn;
            const endDayExclusiveKey = checkOut;
            const lastNightKey = prevDayKey(endDayExclusiveKey);
            const nightKeys = eachDayKeyInclusive(startDayKey, lastNightKey);
            const nightsCount = nightKeys.length;

            // --- CORREÇÃO DE TIPAGEM: Convertendo chaves para Date ---
            const dateObjects = nightKeys.map(dk => new Date(`${dk}T00:00:00Z`));

            const inventoryAdjustments = await tx.inventoryAdjustment.findMany({
                where: {
                    roomTypeId,
                    date: { in: dateObjects }, // Alterado de dateKey para date
                },
            });


            // --- TRAVA 2: DISPONIBILIDADE FÍSICA ---
            const inventoryByDay = new Map<string, number>(
                inventoryAdjustments.map((row) => [row.date.toISOString().split('T')[0], row.totalUnits])
            );

            if (inventoryAdjustments.some((row) => row.totalUnits === 0)) {
                throw new Error('No availability');
            }

            // (Lógica de OverlappingBookings e PendingModifier mantida conforme seu original...)
            const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10));
            const pendingModifier = `-${ttlMinutes} minutes`;
            const overlappingBookings = await tx.$queryRaw<{ checkInDay: string; checkOutDay: string }[]>`
                SELECT substr(checkIn, 1, 10) as checkInDay, substr(checkOut, 1, 10) as checkOutDay
                FROM Booking
                WHERE roomTypeId = ${roomTypeId}
                  AND (
                    status NOT IN ('CANCELLED', 'PENDING')
                    OR (status = 'PENDING' AND createdAt >= datetime('now', ${pendingModifier}))
                  )
                  AND substr(checkIn, 1, 10) < ${endDayExclusiveKey}
                  AND substr(checkOut, 1, 10) > ${startDayKey}
            `;

            const bookedCountByDay = new Map<string, number>();
            for (const b of overlappingBookings) {
                const bStart = b.checkInDay;
                const bEndExclusive = b.checkOutDay;
                const rangeStart = compareDayKey(bStart, startDayKey) < 0 ? startDayKey : bStart;
                const rangeEnd = compareDayKey(prevDayKey(bEndExclusive), lastNightKey) > 0 ? lastNightKey : prevDayKey(bEndExclusive);
                for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                    bookedCountByDay.set(dayKey, (bookedCountByDay.get(dayKey) || 0) + 1);
                }
            }

            for (const key of nightKeys) {
                const totalUnitsForDay = inventoryByDay.get(key) ?? roomType.totalUnits;
                const booked = bookedCountByDay.get(key) || 0;
                if (booked >= totalUnitsForDay) throw new Error('No availability');
            }

            // Cálculo de Preço
            let baseTotalForStay = 0;
            for (const night of nightKeys) {
                const rate = roomType.rates.find(r => {
                    const rStart = r.startDate.toISOString().split('T')[0];
                    const rEnd = r.endDate.toISOString().split('T')[0];
                    return night >= rStart && night <= rEnd;
                });
                baseTotalForStay += rate ? Number(rate.price) : Number(roomType.basePrice);
            }

            const breakdown = calculateBookingPrice({
                nights: nightsCount,
                baseTotalForStay,
                adults: effectiveAdults,
                childrenAges: normalizedChildrenAges,
                includedAdults: roomType.includedAdults,
                maxGuests: roomType.maxGuests,
                extraAdultFee: Number(roomType.extraAdultFee),
                child6To11Fee: Number(roomType.child6To11Fee),
            });

            const guestRecord = await tx.guest.create({
                data: { name: guest.name, email: guest.email, phone: guest.phone }
            });

            return tx.booking.create({
                data: {
                    roomTypeId,
                    guestId: guestRecord.id,
                    checkIn: parseLocalDate(checkIn),
                    checkOut: parseLocalDate(checkOut),
                    totalPrice: breakdown.total,
                    status: 'PENDING',
                },
            });
        });

        if (!booking) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        return NextResponse.json(booking, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'MinLos error') {
            return NextResponse.json({ error: 'A estadia é menor que o mínimo de noites permitido' }, { status: 409 });
        }
        // ... (restante do tratamento de erros igual ao seu original)
        return NextResponse.json({ error: 'Error creating booking' }, { status: 500 });
    }
}
