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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            name,
            description,
            capacity,
            totalUnits,
            basePrice,
            amenities,
            photos,
        } = body || {};

        if (!name || !description || capacity === undefined || totalUnits === undefined || basePrice === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const room = await prisma.roomType.create({
            data: {
                name: String(name),
                description: String(description),
                capacity: Number.parseInt(String(capacity), 10),
                totalUnits: Number.parseInt(String(totalUnits), 10),
                basePrice: Number(String(basePrice)),
                amenities: String(amenities || ''),
                photos: Array.isArray(photos)
                    ? {
                        create: photos
                            .filter((url: unknown) => typeof url === 'string' && url.trim().length > 0)
                            .map((url: string) => ({ url })),
                    }
                    : undefined,
            },
            include: { photos: true },
        });

        return NextResponse.json(room, { status: 201 });
    } catch (error) {
        console.error('[Admin Rooms Create] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao criar quarto' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { roomTypeId, totalUnits } = body;

        if (totalUnits === undefined || totalUnits < 0) {
            return NextResponse.json(
                { error: 'Quantidade inválida' },
                { status: 400 }
            );
        }

        if (roomTypeId === 'all') {
            // Update all rooms
            await prisma.roomType.updateMany({
                data: {
                    totalUnits: Number(totalUnits)
                }
            });
        } else {
            // Update specific room
            await prisma.roomType.update({
                where: { id: roomTypeId },
                data: {
                    totalUnits: Number(totalUnits)
                }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Admin Rooms Batch] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao atualizar quartos' },
            { status: 500 }
        );
    }
}
