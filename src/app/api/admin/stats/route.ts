import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        // Buscar estatísticas
        const [
            totalBookings,
            pendingBookings,
            confirmedBookings,
            payments
        ] = await Promise.all([
            prisma.booking.count(),
            prisma.booking.count({ where: { status: 'PENDING' } }),
            prisma.booking.count({ where: { status: 'CONFIRMED' } }),
            prisma.payment.findMany({
                where: { status: 'APPROVED' },
                select: { amount: true }
            })
        ]);

        const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

        return NextResponse.json({
            totalBookings,
            pendingBookings,
            confirmedBookings,
            totalRevenue
        });

    } catch (error) {
        console.error('[Admin Stats] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar estatísticas' },
            { status: 500 }
        );
    }
}
