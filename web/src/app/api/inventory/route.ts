import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { assertDayKey } from '@/lib/day-key';

export async function GET(request: Request) {
    const auth = await requireAdminAuth();
    if (auth) return auth;

    const { searchParams } = new URL(request.url);
    const roomTypeId = searchParams.get('roomTypeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        const where: any = {};
        if (roomTypeId) where.roomTypeId = roomTypeId;
        if (startDate && endDate) {
            try {
                assertDayKey(startDate, 'startDate');
                assertDayKey(endDate, 'endDate');
            } catch (e) {
                return NextResponse.json(
                    { error: e instanceof Error ? e.message : 'Invalid date format. Use YYYY-MM-DD' },
                    { status: 400 }
                );
            }
            where.date = {
                gte: startDate,
                lte: endDate,
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
        const auth = await requireAdminAuth();
        if (auth) return auth;

        const body = await request.json();
        const { roomTypeId, date, totalUnits } = body;
        try {
            assertDayKey(date, 'date');
        } catch (e) {
            return NextResponse.json(
                { error: e instanceof Error ? e.message : 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        // Upsert to handle both creation and update of inventory for a specific date
        const inventory = await prisma.inventoryAdjustment.upsert({
            where: {
                roomTypeId_date: {
                    roomTypeId,
                    date,
                },
            },
            update: {
                totalUnits: parseInt(totalUnits),
            },
            create: {
                roomTypeId,
                date,
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
