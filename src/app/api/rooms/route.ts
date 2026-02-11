import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const rooms = await prisma.roomType.findMany({
            orderBy: { name: 'asc' }
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
