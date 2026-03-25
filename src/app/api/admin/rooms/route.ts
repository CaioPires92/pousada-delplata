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
            inventoryFor4Guests,
            basePrice,
            amenities,
            photos,
        } = body || {};

        if (!name || !description || capacity === undefined || totalUnits === undefined || basePrice === undefined) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const inventoryTotal = Number.parseInt(String(totalUnits), 10);
        const inventoryFor4 = Math.max(0, Number.parseInt(String(inventoryFor4Guests ?? 0), 10) || 0);
        if (inventoryFor4 > inventoryTotal) {
            return NextResponse.json({ error: 'Subinventário de 4 hóspedes não pode exceder o total de unidades' }, { status: 400 });
        }

        const room = await prisma.roomType.create({
            data: {
                name: String(name),
                description: String(description),
                capacity: Number.parseInt(String(capacity), 10),
                totalUnits: inventoryTotal,
                inventoryFor4Guests: inventoryFor4,
                maxGuests: inventoryFor4 > 0 ? 4 : 3,
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
        const { roomTypeId, totalUnits, inventoryFor4Guests, basePrice, capacity } = body;

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
        if (inventoryFor4Guests !== undefined && inventoryFor4Guests < 0) {
            return NextResponse.json(
                { error: 'Subinventário de 4 hóspedes inválido' },
                { status: 400 }
            );
        }

        if (roomTypeId === 'all') {
            const rooms = await prisma.roomType.findMany({
                select: { id: true, basePrice: true, totalUnits: true, inventoryFor4Guests: true }
            });

            await prisma.$transaction(async (tx) => {
                for (const room of rooms) {
                    const nextTotalUnits = totalUnits !== undefined ? Number(totalUnits) : Number(room.totalUnits);
                    const nextInventoryFor4GuestsRaw = inventoryFor4Guests !== undefined
                        ? Number(inventoryFor4Guests)
                        : Number(room.inventoryFor4Guests ?? 0);
                    const nextInventoryFor4Guests = Math.max(0, Math.min(nextTotalUnits, nextInventoryFor4GuestsRaw));

                    await tx.roomType.update({
                        where: { id: room.id },
                        data: {
                            ...(totalUnits !== undefined ? { totalUnits: nextTotalUnits } : {}),
                            ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
                            ...(capacity !== undefined ? { capacity: Number(capacity) } : {}),
                            ...(inventoryFor4Guests !== undefined || totalUnits !== undefined
                                ? {
                                    inventoryFor4Guests: nextInventoryFor4Guests,
                                    maxGuests: nextInventoryFor4Guests > 0 ? 4 : 3,
                                }
                                : {}),
                        }
                    });
                }

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
                select: { basePrice: true, totalUnits: true, inventoryFor4Guests: true }
            });
            if (!existingRoom) {
                return NextResponse.json({ error: 'Quarto não encontrado' }, { status: 404 });
            }

            const nextTotalUnits = totalUnits !== undefined ? Number(totalUnits) : Number(existingRoom.totalUnits);
            const nextInventoryFor4GuestsRaw = inventoryFor4Guests !== undefined
                ? Number(inventoryFor4Guests)
                : Number(existingRoom.inventoryFor4Guests ?? 0);
            const nextInventoryFor4Guests = Math.max(0, Math.min(nextTotalUnits, nextInventoryFor4GuestsRaw));

            await prisma.roomType.update({
                where: { id: roomTypeId },
                data: {
                    ...(totalUnits !== undefined ? { totalUnits: nextTotalUnits } : {}),
                    ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
                    ...(capacity !== undefined ? { capacity: Number(capacity) } : {}),
                    ...(inventoryFor4Guests !== undefined || totalUnits !== undefined
                        ? {
                            inventoryFor4Guests: nextInventoryFor4Guests,
                            maxGuests: nextInventoryFor4Guests > 0 ? 4 : 3,
                        }
                        : {}),
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
