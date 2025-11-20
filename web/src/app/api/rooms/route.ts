import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const rooms = await prisma.roomType.findMany({
            include: {
                photos: true,
            },
        });
        return NextResponse.json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        return NextResponse.json(
            { error: 'Error fetching rooms' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, description, capacity, basePrice, amenities, photos } = body;

        const room = await prisma.roomType.create({
            data: {
                name,
                description,
                capacity: parseInt(capacity),
                basePrice: parseFloat(basePrice),
                amenities,
                photos: {
                    create: photos?.map((url: string) => ({ url })) || [],
                },
            },
            include: {
                photos: true,
            },
        });

        return NextResponse.json(room, { status: 201 });
    } catch (error) {
        console.error('Error creating room:', error);
        return NextResponse.json(
            { error: 'Error creating room' },
            { status: 500 }
        );
    }
}
