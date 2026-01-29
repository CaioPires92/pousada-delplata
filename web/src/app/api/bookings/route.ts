import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';
import { assertDayKey, compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';
import { parseLocalDate } from '@/lib/date-utils';

export async function POST(request: Request) {
    let ctxRoomTypeId: string | undefined;
    let ctxCheckIn: string | undefined;
    let ctxCheckOut: string | undefined;
    try {
        const body = await request.json();
        const { roomTypeId, checkIn, checkOut, guest, totalPrice } = body;
        ctxRoomTypeId = roomTypeId;
        ctxCheckIn = checkIn;
        ctxCheckOut = checkOut;

        // 1. Validate input
        if (!roomTypeId || !checkIn || !checkOut || !guest || !totalPrice) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const booking = await prisma.$transaction(async (tx) => {
            const roomType = await tx.roomType.findUnique({ where: { id: roomTypeId } });
            if (!roomType) return null;

            try {
                assertDayKey(checkIn, 'checkIn');
                assertDayKey(checkOut, 'checkOut');
            } catch {
                throw new Error('Invalid dates');
            }
            if (compareDayKey(checkIn, checkOut) >= 0) {
                throw new Error('Invalid dates');
            }

            const startDayKey = checkIn;
            const endDayExclusiveKey = checkOut;
            const lastNightKey = prevDayKey(endDayExclusiveKey);

            const inventoryAdjustments = await tx.inventoryAdjustment.findMany({
                where: {
                    roomTypeId,
                    date: { gte: startDayKey, lt: endDayExclusiveKey },
                },
            });
            const inventoryByDay = new Map(
                inventoryAdjustments.map((row) => [row.date, row.totalUnits])
            );

            const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);
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
                if (!bStart || !bEndExclusive) continue;

                const rangeStart = compareDayKey(bStart, startDayKey) < 0 ? startDayKey : bStart;
                const endInclusive = prevDayKey(bEndExclusive);
                const rangeEnd = compareDayKey(endInclusive, lastNightKey) > 0 ? lastNightKey : endInclusive;
                if (compareDayKey(rangeStart, rangeEnd) > 0) continue;

                for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                    bookedCountByDay.set(dayKey, (bookedCountByDay.get(dayKey) || 0) + 1);
                }
            }

            for (const key of eachDayKeyInclusive(startDayKey, lastNightKey)) {
                const totalUnitsForDay = inventoryByDay.get(key) ?? roomType.totalUnits;
                const booked = bookedCountByDay.get(key) || 0;
                if (booked >= totalUnitsForDay) {
                    throw new Error('No availability');
                }
            }

            const guestRecord = await tx.guest.create({
                data: {
                    name: guest.name,
                    email: guest.email,
                    phone: guest.phone,
                },
            });

            return tx.booking.create({
                data: {
                    roomTypeId,
                    guestId: guestRecord.id,
                    checkIn: parseLocalDate(checkIn),
                    checkOut: parseLocalDate(checkOut),
                    totalPrice: parseFloat(totalPrice),
                    status: 'PENDING',
                },
            });
        });

        if (!booking) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // 4. (Optional) Create Payment Preference here if integrating Mercado Pago immediately
        // For now, we just return the booking to proceed to payment step

        opsLog('info', 'BOOKING_CREATED', {
            bookingId: booking.id,
            roomTypeId: ctxRoomTypeId,
            checkIn: ctxCheckIn,
            checkOut: ctxCheckOut,
        });
        return NextResponse.json(booking, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'No availability') {
            opsLog('warn', 'BOOKING_NO_AVAILABILITY', {
                roomTypeId: ctxRoomTypeId,
                checkIn: ctxCheckIn,
                checkOut: ctxCheckOut,
            });
            return NextResponse.json({ error: 'Sem disponibilidade para o período selecionado' }, { status: 409 });
        }
        if (error instanceof Error && error.message === 'Invalid dates') {
            opsLog('warn', 'BOOKING_INVALID_DATES', {
                roomTypeId: ctxRoomTypeId,
                checkIn: ctxCheckIn,
                checkOut: ctxCheckOut,
            });
            return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 });
        }
        Sentry.captureException(error);
        opsLog('error', 'BOOKING_CREATE_ERROR', {
            roomTypeId: ctxRoomTypeId,
            checkIn: ctxCheckIn,
            checkOut: ctxCheckOut,
        });
        return NextResponse.json(
            { error: 'Error creating booking' },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Admin only - list all bookings
    // In a real app, add auth check here
    try {
        const auth = await requireAdminAuth();
        if (auth) return auth;

        const bookings = await prisma.booking.findMany({
            include: {
                guest: true,
                roomType: true,
                payment: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return NextResponse.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return NextResponse.json({ error: 'Error fetching bookings' }, { status: 500 });
    }
}
