import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
    request: NextRequest,
    {
        params,
    }: {
        params: { [key: string]: string | string[] };
    }
) {
    try {
        const id = params.id as string; // rota [id]

        const data = await request.json();

        const updatedRoom = await prisma.roomType.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                capacity: parseInt(data.capacity, 10),
                totalUnits: parseInt(data.totalUnits, 10),
                basePrice: parseFloat(data.basePrice),
                amenities: data.amenities,
            },
        });

        return NextResponse.json(updatedRoom, { status: 200 });
    } catch (error) {
        console.error('[Admin Room Update] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao atualizar quarto' },
            { status: 500 }
        );
    }
}