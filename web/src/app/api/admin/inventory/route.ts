import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomTypeId, date, totalUnits } = body;

        if (!roomTypeId || !date || totalUnits === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }
        
        // Upsert Inventory Adjustment
        const adjustment = await prisma.inventoryAdjustment.upsert({
            where: {
                roomTypeId_date: {
                    roomTypeId,
                    date
                }
            },
            update: {
                totalUnits: parseInt(totalUnits)
            },
            create: {
                roomTypeId,
                date,
                totalUnits: parseInt(totalUnits)
            }
        });

        return NextResponse.json(adjustment);

    } catch (error) {
        console.error('Error updating inventory:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
