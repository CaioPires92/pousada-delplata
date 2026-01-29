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
            where.startDate = { lte: endDate };
            where.endDate = { gte: startDate };
        }

        const rates = await prisma.rate.findMany({
            where,
            include: { roomType: true },
        });
        return NextResponse.json(rates);
    } catch (error) {
        console.error('Error fetching rates:', error);
        return NextResponse.json(
            { error: 'Error fetching rates' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth) return auth;

        const text = await request.text();
        if (!text) {
             return NextResponse.json(
                { error: 'Request body is empty' },
                { status: 400 }
            );
        }
        
        const body = JSON.parse(text);
        const { 
            roomTypeId, 
            startDate, 
            endDate, 
            price,
            cta,
            ctd,
            stopSell,
            minLos
        } = body;

        try {
            assertDayKey(startDate, 'startDate');
            assertDayKey(endDate, 'endDate');
        } catch (e) {
            return NextResponse.json(
                { error: e instanceof Error ? e.message : 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        const rate = await prisma.rate.create({
            data: {
                roomTypeId,
                startDate,
                endDate,
                price: parseFloat(price),
                cta: cta || false,
                ctd: ctd || false,
                stopSell: stopSell || false,
                minLos: minLos ? parseInt(minLos) : 1,
            },
        });

        return NextResponse.json(rate, { status: 201 });
    } catch (error) {
        console.error('Error creating rate:', error);
        return NextResponse.json(
            { error: 'Error creating rate' },
            { status: 500 }
        );
    }
}
