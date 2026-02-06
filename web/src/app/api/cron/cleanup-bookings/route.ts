import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Verifica segurança da Vercel
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        // Define o limite de 30 minutos
        const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000);

        const result = await prisma.booking.updateMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: trintaMinutosAtras }
            },
            data: {
                status: 'EXPIRED'
            }
        });

        console.log(`[Cron Cleanup] ${result.count} reservas expiradas.`);
        return NextResponse.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Erro no Cron:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}