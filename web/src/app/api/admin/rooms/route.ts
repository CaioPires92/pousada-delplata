import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const rooms = await prisma.roomType.findMany({
            include: {
                photos: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        return NextResponse.json(rooms);

    } catch (error) {
        console.error('[Admin Rooms] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar quartos' },
            { status: 500 }
        );
    }
}
