import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { assertDayKey, compareDayKey, eachDayKeyInclusive, prevDayKey } from '@/lib/day-key';

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();
        const { roomTypeId, startDate, endDate, updates, date, totalUnits } = body;
        const coerceToYmd = (input: unknown, label: string): string => {
            if (typeof input !== 'string' || !input.trim()) {
                throw new Error(`${label} inválida`);
            }
            const value = input.includes('T') ? input.slice(0, 10) : input.trim();
            assertDayKey(value, label);
            return value;
        };

        // --- CASO 1: ATUALIZAÇÃO EM LOTE (BULK) ---
        if (startDate && endDate && updates) {
            const inventoryValue = parseInt(updates.inventory);
            const requestedUnits = Math.max(0, Number.isFinite(inventoryValue) ? inventoryValue : 0);
            const targetIds = roomTypeId === 'all'
                ? (await prisma.roomType.findMany()).map((r) => r.id)
                : [roomTypeId];

            const operations = [];
            let appliedLimit = false;

            for (const id of targetIds) {
                const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);
                const startStr = coerceToYmd(startDate, 'startDate');
                const endStr = coerceToYmd(endDate, 'endDate');
                const start = new Date(`${startStr}T12:00:00Z`);
                const end = new Date(`${endStr}T12:00:00Z`);

                const roomType = await prisma.roomType.findUnique({ where: { id } });
                const capacityTotal = Number(roomType?.totalUnits ?? 1);

                const activeBookings = await prisma.booking.findMany({
                    where: {
                        roomTypeId: id,
                        status: { in: ['CONFIRMED', 'PAID', 'PENDING'] },
                        OR: [
                            { status: { in: ['CONFIRMED', 'PAID'] } },
                            {
                                AND: [
                                    { status: 'PENDING' },
                                    { createdAt: { gte: new Date(Date.now() - ttlMinutes * 60000) } },
                                ],
                            },
                        ],
                        checkIn: { lte: end },
                        checkOut: { gt: start },
                    },
                });

                const bookingsCountByDay = new Map<string, number>();
                for (const b of activeBookings) {
                    const bIn = b.checkIn.toISOString().split('T')[0];
                    const bOut = b.checkOut.toISOString().split('T')[0];

                    const rangeStart = compareDayKey(bIn, startStr) < 0 ? startStr : bIn;
                    const endInclusive = prevDayKey(bOut);
                    const rangeEnd = compareDayKey(endInclusive, endStr) > 0 ? endStr : endInclusive;

                    if (compareDayKey(rangeStart, rangeEnd) <= 0) {
                        for (const dayKey of eachDayKeyInclusive(rangeStart, rangeEnd)) {
                            bookingsCountByDay.set(dayKey, (bookingsCountByDay.get(dayKey) || 0) + 1);
                        }
                    }
                }

                const current = new Date(`${startStr}T12:00:00Z`);
                const last = new Date(`${endStr}T12:00:00Z`);

                while (current <= last) {
                    const dKey = current.toISOString().split('T')[0];
                    const bookingsCount = bookingsCountByDay.get(dKey) || 0;
                    const maxSellable = Math.max(0, capacityTotal - bookingsCount);
                    const safeUnits = Math.max(0, Math.min(maxSellable, requestedUnits));
                    appliedLimit = appliedLimit || safeUnits !== requestedUnits;

                    operations.push(
                        prisma.inventoryAdjustment.upsert({
                            where: { roomTypeId_dateKey: { roomTypeId: id, dateKey: dKey } },
                            update: { totalUnits: safeUnits, date: new Date(current) },
                            create: {
                                roomTypeId: id,
                                dateKey: dKey,
                                date: new Date(current),
                                totalUnits: safeUnits,
                            },
                        })
                    );
                    current.setUTCDate(current.getUTCDate() + 1);
                }
            }
            await prisma.$transaction(operations);
            return NextResponse.json({ success: true, appliedLimit });
        }

        // --- CASO 2: ATUALIZAÇÃO INDIVIDUAL ---
        if (roomTypeId && date && totalUnits !== undefined) {
            const dKey = coerceToYmd(date, 'date');
            const isoDate = new Date(`${dKey}T12:00:00Z`);
            const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
            const capacityTotal = Number(roomType?.totalUnits ?? 1);

            const ttlMinutes = Math.max(1, parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);
            const activeBookingsCount = await prisma.booking.count({
                where: {
                    roomTypeId,
                    checkIn: { lt: new Date(`${dKey}T23:59:59Z`) },
                    checkOut: { gt: new Date(`${dKey}T00:00:00Z`) },
                    OR: [
                        { status: 'CONFIRMED' },
                        { status: 'PAID' },
                        {
                            status: 'PENDING',
                            createdAt: { gte: new Date(Date.now() - ttlMinutes * 60000) },
                        },
                    ],
                },
            });

            const requestedUnits = parseInt(totalUnits);
            const normalizedRequested = Number.isFinite(requestedUnits) ? requestedUnits : 0;
            const maxSellable = Math.max(0, capacityTotal - activeBookingsCount);
            const safeUnits = Math.max(0, Math.min(maxSellable, normalizedRequested));

            const adjustment = await prisma.inventoryAdjustment.upsert({
                where: { roomTypeId_dateKey: { roomTypeId, dateKey: dKey } },
                update: { totalUnits: safeUnits, date: isoDate },
                create: {
                    roomTypeId,
                    dateKey: dKey,
                    date: isoDate,
                    totalUnits: safeUnits,
                },
            });
            return NextResponse.json({ ...adjustment, appliedLimit: safeUnits !== normalizedRequested });
        }

        return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 });
    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error('PRISMA ERROR:', { code: error.code, meta: error.meta });
        } else {
            console.error('ERRO DETALHADO:', error);
        }
        return NextResponse.json(
            {
                error: 'Internal Server Error',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
