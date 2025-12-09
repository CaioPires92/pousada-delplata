import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const data = await request.json();

        const updatedRoom = await prisma.roomType.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                capacity: data.capacity,
                totalUnits: data.totalUnits,
                basePrice: data.basePrice,
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
