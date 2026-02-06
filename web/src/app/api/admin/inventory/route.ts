import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();
        const { roomTypeId, startDate, endDate, updates, date, totalUnits } = body;

        // --- CASO 1: ATUALIZAÇÃO EM LOTE (BULK) ---
        if (startDate && endDate && updates) {
            const inventoryValue = parseInt(updates.inventory);
            const targetIds = roomTypeId === 'all'
                ? (await prisma.roomType.findMany()).map(r => r.id)
                : [roomTypeId];

            const operations = [];

            for (const id of targetIds) {
                let current = new Date(`${startDate}T12:00:00Z`);
                const last = new Date(`${endDate}T12:00:00Z`);

                while (current <= last) {
                    const dKey = current.toISOString().split('T')[0];
                    const roomType = await prisma.roomType.findUnique({ where: { id } });
                    const maxUnits = Number(roomType?.totalUnits ?? 1);
                    const safeUnits = Math.max(0, Math.min(maxUnits, inventoryValue));

                    operations.push(
                        prisma.inventoryAdjustment.upsert({
                            where: { roomTypeId_dateKey: { roomTypeId: id, dateKey: dKey } },
                            update: { totalUnits: safeUnits, date: new Date(current) },
                            create: {
                                roomTypeId: id,
                                dateKey: dKey,
                                date: new Date(current),
                                totalUnits: safeUnits
                            }
                        })
                    );
                    current.setUTCDate(current.getUTCDate() + 1);
                }
            }
            await prisma.$transaction(operations);
            return NextResponse.json({ success: true });
        }

        // --- CASO 2: ATUALIZAÇÃO INDIVIDUAL ---
        if (roomTypeId && date && totalUnits !== undefined) {
            const inputDate = new Date(date);
            const dKey = inputDate.toISOString().slice(0, 10);
            const isoDate = new Date(`${dKey}T12:00:00Z`);
            const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
            const maxUnits = Number(roomType?.totalUnits ?? 1);
            const safeUnits = Math.max(0, Math.min(maxUnits, parseInt(totalUnits)));

            const adjustment = await prisma.inventoryAdjustment.upsert({
                where: { roomTypeId_dateKey: { roomTypeId, dateKey: dKey } },
                update: { totalUnits: safeUnits, date: isoDate },
                create: {
                    roomTypeId,
                    dateKey: dKey,
                    date: isoDate,
                    totalUnits: safeUnits
                }
            });
            return NextResponse.json(adjustment);
        }

        return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 });

    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error('PRISMA ERROR:', { code: error.code, meta: error.meta });
        } else {
            console.error('ERRO DETALHADO:', error);
        }
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message
        }, { status: 500 });
    }
}
