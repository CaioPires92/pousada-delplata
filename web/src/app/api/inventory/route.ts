import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { assertDayKey } from '@/lib/day-key';

export async function GET(request: Request) {
    const auth = await requireAdminAuth();
    if (auth instanceof Response) return auth;

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
                    { error: e instanceof Error ? e.message : 'Formato de data inválido. Use YYYY-MM-DD' },
                    { status: 400 }
                );
            }
            where.dateKey = {
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
        console.error('Erro ao buscar inventário:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar inventário' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();
        const { roomTypeId, date, totalUnits } = body;
        try {
            assertDayKey(date, 'date');
        } catch (e) {
            return NextResponse.json(
                { error: e instanceof Error ? e.message : 'Formato de data inválido. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        const dateKey = String(date);
        const isoDate = new Date(`${date}T00:00:00Z`);
        // Upsert using day-key, keeping legacy DateTime field populated
        const inventory = await prisma.inventoryAdjustment.upsert({
            where: {
                roomTypeId_dateKey: {
                    roomTypeId,
                    dateKey,
                }
            },
            update: {
                totalUnits: parseInt(totalUnits),
                date: isoDate
            },
            create: {
                roomTypeId,
                dateKey,
                date: isoDate,
                totalUnits: parseInt(totalUnits),
            },
        });

        return NextResponse.json(inventory, { status: 201 });
    } catch (error) {
        console.error('Erro ao atualizar inventário:', error);
        return NextResponse.json(
            { error: 'Erro ao atualizar inventário' },
            { status: 500 }
        );
    }
}
