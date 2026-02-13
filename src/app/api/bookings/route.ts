import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { calculateBookingPrice } from '@/lib/booking-price';
import { parseLocalDate } from '@/lib/date-utils';
import { sendBookingCreatedAlertEmail } from '@/lib/email';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomTypeId, checkIn, checkOut, guest, adults, childrenAges } = body;

        if (!roomTypeId || !checkIn || !checkOut || !guest || !guest.email) {
            return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
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
                    },
                },
            });

            if (!roomType) return null;

            const nightKeys = eachDayKeyInclusive(checkIn, prevDayKey(checkOut));

            let baseTotalForStay = 0;
            let requiredMinLos = 1;
            for (const night of nightKeys) {
                const rate = roomType.rates.find(r => {
                    const rStart = r.startDate.toISOString().split('T')[0];
                    const rEnd = r.endDate.toISOString().split('T')[0];
                    return night >= rStart && night <= rEnd;
                });
                baseTotalForStay += rate ? Number(rate.price) : Number(roomType.basePrice);
                const dayMinLos = rate ? Number(rate.minLos) : 1;
                if (dayMinLos > requiredMinLos) requiredMinLos = dayMinLos;
            }

            if (nightKeys.length < requiredMinLos) {
                throw new Error(`min_stay_required:${requiredMinLos}`);
            }

            const breakdown = calculateBookingPrice({
                nights: nightKeys.length,
                baseTotalForStay: baseTotalForStay,
                adults: Number(adults),
                childrenAges: agesArrayInput,
                includedAdults: Number(roomType.includedAdults),
                maxGuests: Number(roomType.maxGuests),
                extraAdultFee: Number(roomType.extraAdultFee),
                child6To11Fee: Number(roomType.child6To11Fee),
            });

            // Lógica para Hóspede (Evita erro de tipagem e duplicidade)
            let guestRecord = await tx.guest.findFirst({
                where: { email: guest.email }
            });

            if (guestRecord) {
                guestRecord = await tx.guest.update({
                    where: { id: guestRecord.id },
                    data: { name: guest.name, phone: guest.phone }
                });
            } else {
                guestRecord = await tx.guest.create({
                    data: { name: guest.name, email: guest.email, phone: guest.phone }
                });
            }

            return tx.booking.create({
                data: {
                    roomTypeId,
                    guestId: guestRecord.id,
                    checkIn: parseLocalDate(checkIn),
                    checkOut: parseLocalDate(checkOut),
                    totalPrice: Number(breakdown.total),
                    status: 'PENDING',
                },
            });
        });

        if (!booking) return NextResponse.json({ error: 'Quarto não encontrado' }, { status: 404 });
        return NextResponse.json(booking, { status: 201 });

    } catch (error: any) {
        console.error('[Booking API Error]:', error);
        if (typeof error?.message === 'string' && error.message.startsWith('min_stay_required:')) {
            const minLos = error.message.split(':')[1] || '1';
            return NextResponse.json({ error: 'min_stay_required', minLos: Number(minLos) }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
