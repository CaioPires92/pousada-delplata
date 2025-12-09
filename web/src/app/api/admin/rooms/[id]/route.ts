import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type RouteContext = {
    params: {
        id: string;
    };
};

export async function PUT(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = params; // vem do [id] na rota
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
