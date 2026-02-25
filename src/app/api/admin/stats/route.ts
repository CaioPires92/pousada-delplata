import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

function isTestPayment(payment: { provider?: string | null; method?: string | null; providerId?: string | null }) {
    const provider = String(payment.provider || '').trim().toUpperCase();
    const method = String(payment.method || '').trim().toUpperCase();
    const providerId = String(payment.providerId || '').trim().toUpperCase();
    return provider === 'MANUAL_TEST' || method === 'MANUAL_TEST' || providerId.startsWith('TEST_');
}

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const [totalBookings, pendingBookings, confirmedBookings, payments] = await Promise.all([
            prisma.booking.count(),
            prisma.booking.count({ where: { status: 'PENDING' } }),
            prisma.booking.count({ where: { status: 'CONFIRMED' } }),
            prisma.payment.findMany({
                where: { status: 'APPROVED' },
                select: { amount: true, provider: true, method: true, providerId: true },
            }),
        ]);

        const totalRevenue = payments.reduce((sum, payment) => {
            if (isTestPayment(payment)) return sum;
            return sum + Number(payment.amount || 0);
        }, 0);

        return NextResponse.json({
            totalBookings,
            pendingBookings,
            confirmedBookings,
            totalRevenue,
        });
    } catch (error) {
        console.error('[Admin Stats] Error:', error);
        return NextResponse.json({ error: 'Erro ao carregar estatísticas' }, { status: 500 });
    }
}
