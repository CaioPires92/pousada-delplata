import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const bookings = await prisma.booking.findMany({
            include: {
                guest: true,
                roomType: true,
                payment: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(bookings);

    } catch (error) {
        console.error('[Admin Bookings] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar reservas' },
            { status: 500 }
        );
    }
}
