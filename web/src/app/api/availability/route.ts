import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { assertDayKey, compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { BookingPriceError, calculateBookingPrice } from '@/lib/booking-price';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults');
    const children = searchParams.get('children');
    const childrenAgesParam = searchParams.get('childrenAges');

    if (!checkIn || !checkOut) {
        return NextResponse.json({ error: 'Check-in and check-out dates are required' }, { status: 400 });
    }

    const adultsCount = Number.parseInt(adults || '0', 10) || 0;
    const childrenCount = Number.parseInt(children || '0', 10) || 0;
    const childrenAges =
        typeof childrenAgesParam === 'string' && childrenAgesParam.trim().length > 0
            ? childrenAgesParam.split(',').map((s) => s.trim()).filter((s) => s.length > 0).map((s) => Number.parseInt(s, 10))
            : [];

    if (childrenCount !== childrenAges.length) {
        return NextResponse.json({ error: 'missing_children_ages' }, { status: 400 });
    }

    const effectiveGuests = adultsCount + childrenCount;

    try {
        assertDayKey(checkIn, 'checkIn');
        assertDayKey(checkOut, 'checkOut');
    } catch (e) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const lastNight = prevDayKey(checkOut);
    let nights: string[];
    let stayLength: number;
    try {
        nights = eachDayKeyInclusive(checkIn, lastNight);
        stayLength = nights.length;
    } catch (e: any) {
        const msg = typeof e?.message === 'string' ? e.message : '';
        const isRangeError = msg.includes('Invalid date range');
        return NextResponse.json(
            { error: isRangeError ? 'invalid_date_range' : 'invalid_dates', message: msg || undefined },
            { status: 400 }
        );
    }

    try {
        // 1. Busca RoomTypes com as novas tipagens de DateTime
        const roomTypes = await prisma.roomType.findMany({
            where: { maxGuests: { gte: effectiveGuests } },
            include: {
                photos: true,
                rates: {
                    where: {
                        startDate: { lte: new Date(checkOut) },
                        endDate: { gte: new Date(checkIn) },
                    },
                    orderBy: { createdAt: 'desc' }
                },
                inventory: true,
            },
        });

        const availableRooms = [];
        const ttlMinutes = Number(process.env.PENDING_BOOKING_TTL_MINUTES) || 30;

        for (const room of roomTypes) {
            let isAvailable = true;
            let baseTotalForStay = 0;

            // --- Validação de Regras de Check-in ---
            const checkInRate = room.rates.find((r: any) => {
                const sDate = typeof r.startDate === 'string'
                    ? (r.startDate.includes('T') || r.startDate.includes(' ') ? r.startDate.slice(0, 10) : r.startDate.trim())
                    : r.startDate.toISOString().split('T')[0];
                const eDate = typeof r.endDate === 'string'
                    ? (r.endDate.includes('T') || r.endDate.includes(' ') ? r.endDate.slice(0, 10) : r.endDate.trim())
                    : r.endDate.toISOString().split('T')[0];
                return checkIn >= sDate && checkIn <= eDate;
            });

            if (checkInRate) {
                if (checkInRate.cta || stayLength < checkInRate.minLos) isAvailable = false;
            }
            if (!isAvailable) continue;

            // --- BUSCA DE RESERVAS (Substituindo o $queryRaw problemático) ---
            const existingBookings = await prisma.booking.findMany({
                where: {
                    roomTypeId: room.id,
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
                    checkIn: { lte: new Date(lastNight) },
                    checkOut: { gt: new Date(checkIn) },
                }
            });

            const bookingsCountByDay = new Map<string, number>();
            for (const b of existingBookings) {
                const bIn = b.checkIn.toISOString().split('T')[0];
                const bOut = b.checkOut.toISOString().split('T')[0];
                const rangeStart = compareDayKey(bIn, checkIn) < 0 ? checkIn : bIn;
                const endInclusive = prevDayKey(bOut);
                const rangeEnd = compareDayKey(endInclusive, lastNight) > 0 ? lastNight : endInclusive;

                if (compareDayKey(rangeStart, rangeEnd) <= 0) {
                    for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                        bookingsCountByDay.set(dayKey, (bookingsCountByDay.get(dayKey) || 0) + 1);
                    }
                }
            }

            // --- Validação Diária ---
            for (const night of nights) {
                const rate = room.rates.find((r: any) => {
                    const sDate = typeof r.startDate === 'string'
                        ? (r.startDate.includes('T') || r.startDate.includes(' ') ? r.startDate.slice(0, 10) : r.startDate.trim())
                        : r.startDate.toISOString().split('T')[0];
                    const eDate = typeof r.endDate === 'string'
                        ? (r.endDate.includes('T') || r.endDate.includes(' ') ? r.endDate.slice(0, 10) : r.endDate.trim())
                        : r.endDate.toISOString().split('T')[0];
                    return night >= sDate && night <= eDate;
                });

                if (rate?.stopSell) {
                    isAvailable = false;
                    break;
                }

                const bookingsCount = bookingsCountByDay.get(night) || 0;
                const dailyInv = room.inventory.find((i: any) => {
                    const dk = typeof i.date === 'string'
                        ? (i.date.includes('T') || i.date.includes(' ') ? i.date.slice(0, 10) : i.date.trim())
                        : i.date.toISOString().split('T')[0];
                    return dk === night;
                });
                const maxUnits = dailyInv ? dailyInv.totalUnits : room.totalUnits;

                if (bookingsCount >= maxUnits) {
                    isAvailable = false;
                    break;
                }
                baseTotalForStay += rate ? Number(rate.price) : Number(room.basePrice);
            }

            if (isAvailable) {
                try {
                    const breakdown = calculateBookingPrice({
                        nights: stayLength,
                        baseTotalForStay,
                        adults: adultsCount,
                        childrenAges,
                        includedAdults: room.includedAdults,
                        maxGuests: room.maxGuests,
                        extraAdultFee: Number(room.extraAdultFee),
                        child6To11Fee: Number(room.child6To11Fee),
                    });
                    availableRooms.push({ ...room, totalPrice: breakdown.total, priceBreakdown: breakdown });
                } catch (e) {
                    // Guardrail: se cálculo falhar por qualquer motivo, não quebrar toda a rota
                    // Apenas ignorar este quarto e continuar
                    if (!(e instanceof BookingPriceError)) {
                        console.warn('[Availability] Price calc failed unexpectedly for room', { roomId: room.id });
                    }
                }
            }
        }
        return NextResponse.json(availableRooms);
    } catch (error) {
        console.error('Error checking availability:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
