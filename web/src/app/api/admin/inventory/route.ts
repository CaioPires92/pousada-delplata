import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();

        // Verifica se é uma atualização em LOTE (Bulk) ou INDIVIDUAL
        const { roomTypeId, startDate, endDate, updates, date, totalUnits } = body;

        // --- LÓGICA PARA ATUALIZAÇÃO EM LOTE (BULK) ---
        if (startDate && endDate && updates) {
            const inventoryValue = parseInt(updates.inventory);

            // Se roomTypeId for "all", buscamos todos os tipos de quartos
            const targetRoomIds = roomTypeId === 'all'
                ? (await prisma.roomType.findMany()).map(r => r.id)
                : [roomTypeId];

            const results = [];

            for (const id of targetRoomIds) {
                let current = new Date(`${startDate}T00:00:00Z`);
                const last = new Date(`${endDate}T00:00:00Z`);

                while (current <= last) {
                    const dateStr = current.toISOString().split('T')[0];

                    const adjustment = await prisma.inventoryAdjustment.upsert({
                        where: {
                            roomTypeId_dateKey: {
                                roomTypeId: id,
                                dateKey: dateStr,
                            }
                        },
                        update: { totalUnits: inventoryValue, date: current },
                        create: {
                            roomTypeId: id,
                            dateKey: dateStr,
                            date: new Date(current),
                            totalUnits: inventoryValue
                        }
                    });
                    results.push(adjustment);
                    current.setDate(current.getDate() + 1);
                }
            }
            return NextResponse.json({ success: true, count: results.length });
        }

        // --- LÓGICA PARA ATUALIZAÇÃO INDIVIDUAL (A QUE DAVA ERRO 500) ---
        if (!roomTypeId || !date || totalUnits === undefined) {
            return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 });
        }

        const isoDate = new Date(`${date}T00:00:00Z`);

        const adjustment = await prisma.inventoryAdjustment.upsert({
            where: {
                roomTypeId_dateKey: {
                    roomTypeId,
                    dateKey: String(date),
                }
            },
            update: {
                totalUnits: parseInt(totalUnits),
                date: isoDate
            },
            create: {
                roomTypeId,
                dateKey: String(date),
                date: isoDate,
                totalUnits: parseInt(totalUnits)
            }
        });

        return NextResponse.json(adjustment);

    } catch (error) {
        console.error('Erro crítico no inventário:', error);
        return NextResponse.json({
            error: 'Erro Interno do Servidor',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}