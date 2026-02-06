import { NextResponse } from 'next/server';
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

                    operations.push(
                        prisma.inventoryAdjustment.upsert({
                            where: { roomTypeId_dateKey: { roomTypeId: id, dateKey: dKey } },
                            update: { totalUnits: inventoryValue, date: new Date(current) },
                            create: {
                                roomTypeId: id,
                                dateKey: dKey,
                                date: new Date(current),
                                totalUnits: inventoryValue
                            }
                        })
                    );
                    current.setDate(current.getDate() + 1);
                }
            }
            await prisma.$transaction(operations);
            return NextResponse.json({ success: true });
        }

        // --- CASO 2: ATUALIZAÇÃO INDIVIDUAL ---
        if (roomTypeId && date && totalUnits !== undefined) {
            const dKey = String(date);
            const isoDate = new Date(`${date}T12:00:00Z`);

            const adjustment = await prisma.inventoryAdjustment.upsert({
                where: { roomTypeId_dateKey: { roomTypeId, dateKey: dKey } },
                update: { totalUnits: parseInt(totalUnits), date: isoDate },
                create: {
                    roomTypeId,
                    dateKey: dKey,
                    date: isoDate,
                    totalUnits: parseInt(totalUnits)
                }
            });
            return NextResponse.json(adjustment);
        }

        return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 });

    } catch (error: any) {
        console.error('ERRO DETALHADO:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message
        }, { status: 500 });
    }
}