import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { hospedinClient } from '@/lib/hospedin';
import { addDays, format } from 'date-fns';

export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        // Extract body early
        const body = await request.json().catch(() => ({}));
        const { startDate: reqStart, endDate: reqEnd, roomTypeId } = body;

        const roomTypes = await prisma.roomType.findMany({
            where: { 
                externalId: { 
                    not: null
                },
                NOT: { externalId: '' },
                ...(roomTypeId && { id: roomTypeId })
            }
        });

        if (roomTypes.length === 0) {
            return NextResponse.json({ 
                error: roomTypeId 
                    ? 'Acomodação selecionada não possui ID do Hospedin configurado.' 
                    : 'Nenhum quarto configurado com ID do Hospedin.' 
            }, { status: 400 });
        }

        const today = new Date();
        const beginDate = reqStart || format(today, 'yyyy-MM-dd');
        const endDate = reqEnd || format(addDays(today, 60), 'yyyy-MM-dd');

        const results = [];

        for (const room of roomTypes) {
            try {
                const externalId = room.externalId!;
                const availabilities = await hospedinClient.getAvailability(externalId, beginDate, endDate);

                for (const day of availabilities) {
                    // Regra 1: caso haja 2 quartos ou menos a disponibilidade deve ser marcada como esgotada
                    // Regra 2: não deve abrir mais que 2 quartos de cada acomodação mesmo que haja mais no hospedin
                    const localAvail = day.availability <= 2 ? 0 : 2;

                    const dateKey = day.date;
                    const isoDate = new Date(`${dateKey}T00:00:00Z`);

                    await prisma.inventoryAdjustment.upsert({
                        where: {
                            roomTypeId_dateKey: {
                                roomTypeId: room.id,
                                dateKey: dateKey,
                            }
                        },
                        update: {
                            totalUnits: localAvail,
                            date: isoDate
                        },
                        create: {
                            roomTypeId: room.id,
                            dateKey: dateKey,
                            date: isoDate,
                            totalUnits: localAvail,
                        },
                    });
                }
                results.push({ roomName: room.name, daysSynced: availabilities.length });
            } catch (roomError) {
                console.error(`Erro ao sincronizar quarto ${room.name}:`, roomError);
                results.push({ roomName: room.name, error: roomError instanceof Error ? roomError.message : 'Erro desconhecido' });
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        return NextResponse.json({ 
            message: 'Sincronização processada!', 
            results,
            duration: `${duration}s`
        });
    } catch (error) {
        console.error('Erro na sincronização Hospedin:', error);
        return NextResponse.json({ 
            error: 'Erro fatal na sincronização com Hospedin' 
        }, { status: 500 });
    }
}
