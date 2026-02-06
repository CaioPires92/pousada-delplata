import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

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
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

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
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();
        const { roomTypeId, totalUnits, basePrice, capacity } = body;

        if (totalUnits !== undefined && totalUnits < 0) {
            return NextResponse.json(
                { error: 'Quantidade inválida' },
                { status: 400 }
            );
        }
        if (capacity !== undefined && capacity < 0) {
            return NextResponse.json(
                { error: 'Capacidade inválida' },
                { status: 400 }
            );
        }

        if (roomTypeId === 'all') {
            const rooms = await prisma.roomType.findMany({
                select: { id: true, basePrice: true }
            });

            await prisma.$transaction(async (tx) => {
                await tx.roomType.updateMany({
                    data: {
                        ...(totalUnits !== undefined ? { totalUnits: Number(totalUnits) } : {}),
                        ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
                        ...(capacity !== undefined ? { capacity: Number(capacity) } : {})
                    }
                });

                if (basePrice !== undefined) {
                    for (const room of rooms) {
                        await tx.rate.updateMany({
                            where: {
                                roomTypeId: room.id,
                                price: Number(room.basePrice),
                                stopSell: false,
                                cta: false,
                                ctd: false,
                                minLos: 1
                            },
                            data: {
                                price: Number(basePrice)
                            }
                        });
                    }
                }
            });
        } else {
            const existingRoom = await prisma.roomType.findUnique({
                where: { id: roomTypeId },
                select: { basePrice: true }
            });

            await prisma.roomType.update({
                where: { id: roomTypeId },
                data: {
                    ...(totalUnits !== undefined ? { totalUnits: Number(totalUnits) } : {}),
                    ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
                    ...(capacity !== undefined ? { capacity: Number(capacity) } : {})
                }
            });

            if (existingRoom && basePrice !== undefined && Number(existingRoom.basePrice) !== Number(basePrice)) {
                await prisma.rate.updateMany({
                    where: {
                        roomTypeId,
                        price: Number(existingRoom.basePrice),
                        stopSell: false,
                        cta: false,
                        ctd: false,
                        minLos: 1
                    },
                    data: {
                        price: Number(basePrice)
                    }
                });
            }
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
