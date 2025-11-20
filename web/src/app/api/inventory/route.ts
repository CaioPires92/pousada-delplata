import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const roomTypeId = searchParams.get('roomTypeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        const where: any = {};
        if (roomTypeId) where.roomTypeId = roomTypeId;
        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        const inventory = await prisma.inventoryAdjustment.findMany({
            where,
            include: { roomType: true },
        });
        return NextResponse.json(inventory);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return NextResponse.json(
            { error: 'Error fetching inventory' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomTypeId, date, totalUnits } = body;

        // Upsert to handle both creation and update of inventory for a specific date
        const inventory = await prisma.inventoryAdjustment.upsert({
            where: {
                roomTypeId_date: {
                    roomTypeId,
                    date: new Date(date),
                },
            },
            update: {
                totalUnits: parseInt(totalUnits),
            },
            create: {
                roomTypeId,
                date: new Date(date),
                totalUnits: parseInt(totalUnits),
            },
        });

        return NextResponse.json(inventory, { status: 201 });
    } catch (error) {
        console.error('Error updating inventory:', error);
        return NextResponse.json(
            { error: 'Error updating inventory' },
            { status: 500 }
        );
    }
}
