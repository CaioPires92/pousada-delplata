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

        const isoDate = new Date(`${date}T00:00:00Z`);

        // Upsert Inventory Adjustment
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
        console.error('Error updating inventory:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
