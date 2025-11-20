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
            where.startDate = { gte: new Date(startDate) };
            where.endDate = { lte: new Date(endDate) };
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
        const body = await request.json();
        const { roomTypeId, startDate, endDate, price } = body;

        const rate = await prisma.rate.create({
            data: {
                roomTypeId,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                price: parseFloat(price),
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
