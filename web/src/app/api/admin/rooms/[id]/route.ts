import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request) {
    try {
        const url = new URL(request.url);
        const id = url.pathname.split('/').filter(Boolean).pop() as string;
        const data = await request.json();

        const updatedRoom = await prisma.roomType.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                capacity: parseInt(data.capacity),
                totalUnits: parseInt(data.totalUnits),
                basePrice: parseFloat(data.basePrice),
                amenities: data.amenities
            }
        });

        return NextResponse.json(updatedRoom);

    } catch (error) {
        console.error('[Admin Room Update] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao atualizar quarto' },
            { status: 500 }
        );
    }
}
