import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const room = await prisma.roomType.findUnique({
            where: { id },
            include: {
                photos: true,
            },
        });

        if (!room) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(room);
    } catch (error) {
        console.error('Error fetching room:', error);
        return NextResponse.json(
            { error: 'Error fetching room' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, capacity, basePrice, amenities, photos } = body;

        // First update the room details
        const room = await prisma.roomType.update({
            where: { id },
            data: {
                name,
                description,
                capacity: parseInt(capacity),
                basePrice: parseFloat(basePrice),
                amenities,
            },
        });

        // If photos are provided, we might need a strategy to update them.
        // For simplicity, let's assume we replace all photos if 'photos' array is provided.
        if (photos) {
            await prisma.photo.deleteMany({
                where: { roomTypeId: id },
            });

            await prisma.photo.createMany({
                data: photos.map((url: string) => ({
                    url,
                    roomTypeId: id,
                })),
            });
        }

        const updatedRoom = await prisma.roomType.findUnique({
            where: { id },
            include: { photos: true },
        });

        return NextResponse.json(updatedRoom);
    } catch (error) {
        console.error('Error updating room:', error);
        return NextResponse.json(
            { error: 'Error updating room' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.roomType.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Room deleted successfully' });
    } catch (error) {
        console.error('Error deleting room:', error);
        return NextResponse.json(
            { error: 'Error deleting room' },
            { status: 500 }
        );
    }
}
