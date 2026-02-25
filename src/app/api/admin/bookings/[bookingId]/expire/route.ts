import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';
import { readAdminActionReason } from '@/lib/admin-action-reason';

export const runtime = 'nodejs';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { bookingId } = await params;
        if (!bookingId) {
            return NextResponse.json({ error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
        }

        const reason = await readAdminActionReason(request);
        if (!reason) {
            return NextResponse.json(
                {
                    error: 'ACTION_REASON_REQUIRED',
                    message: 'Informe o motivo para marcar a reserva como expirada.',
                },
                { status: 400 }
            );
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
        });

        if (!booking) {
            return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
        }

        if (String(booking.payment?.status || '').toUpperCase() === 'APPROVED') {
            return NextResponse.json(
                {
                    error: 'BOOKING_HAS_APPROVED_PAYMENT',
                    message: 'Reserva com pagamento aprovado nao pode ser marcada como expirada.',
                },
                { status: 409 }
            );
        }

        if (String(booking.status || '').toUpperCase() === 'EXPIRED') {
            return NextResponse.json({ ok: true, alreadyExpired: true, bookingId });
        }

        await prisma.booking.update({
            where: { id: bookingId },
            data: { status: 'EXPIRED' },
        });

        opsLog('info', 'ADMIN_BOOKING_MARKED_EXPIRED', {
            bookingId,
            adminId: auth.adminId,
            reason,
        });

        return NextResponse.json({ ok: true, bookingId, status: 'EXPIRED' });
    } catch (error) {
        console.error('[Admin Booking Expire] Error:', error);
        return NextResponse.json(
            {
                error: 'BOOKING_EXPIRE_FAILED',
                message: 'Nao foi possivel marcar a reserva como expirada.',
            },
            { status: 500 }
        );
    }
}
