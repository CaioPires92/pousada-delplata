import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();
        const { roomTypeId, date, totalUnits } = body;

        if (!roomTypeId || !date || totalUnits === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Converte a string "YYYY-MM-DD" para um objeto Date válido.
        // Adicionamos 'T12:00:00' para garantir que o fuso horário não mude o dia.
        const isoDate = new Date(`${date}T12:00:00Z`);

        // Upsert Inventory Adjustment
        const adjustment = await prisma.inventoryAdjustment.upsert({
            where: {
                roomTypeId_date: {
                    roomTypeId,
                    date: isoDate
                }
            },
            update: {
                totalUnits: parseInt(totalUnits)
            },
            create: {
                roomTypeId,
                date: isoDate,
                totalUnits: parseInt(totalUnits)
            }
        });

        return NextResponse.json(adjustment);

    } catch (error) {
        console.error('Error updating inventory:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}