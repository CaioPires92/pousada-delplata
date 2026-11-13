import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';
import { expireBooking } from '@/lib/expire-stale-bookings';
import { hasPaymentUnderReview } from '@/lib/mercadopago/payment-under-review';
import { asNullableString } from '@/lib/requestValue';

export const runtime = 'nodejs';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { bookingId } = await params;
        const normalizedBookingId = asNullableString(bookingId);
        if (!normalizedBookingId) {
            return NextResponse.json({ error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: normalizedBookingId },
            include: {
                guest: true,
                roomType: true,
                payment: true,
            },
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
            return NextResponse.json({ ok: true, alreadyExpired: true, bookingId: normalizedBookingId });
        }

        if (await hasPaymentUnderReview(booking.id)) {
            return NextResponse.json(
                {
                    error: 'BOOKING_HAS_PAYMENT_UNDER_REVIEW',
                    message: 'Ha um pagamento com cartao em analise pelo Mercado Pago. Aguarde a conclusao antes de expirar.',
                },
                { status: 409 }
            );
        }

        // Mesmos efeitos da expiracao automatica: cupom liberado, alerta e, para reserva
        // pendente, o e-mail ao hospede. A transicao e condicionada ao status lido.
        const currentStatus = String(booking.status || '');
        const result = await expireBooking(booking, {
            source: 'admin_manual_expire',
            expectedStatus: currentStatus,
            reason: 'expired_by_admin',
            sendGuestEmail: currentStatus.toUpperCase() === 'PENDING',
            sendAdminAlert: true,
        });
        if (!result.expired) {
            return NextResponse.json(
                { error: 'BOOKING_STATUS_CHANGED', message: 'A reserva mudou de status. Atualize a pagina e tente novamente.' },
                { status: 409 }
            );
        }

        opsLog('info', 'ADMIN_BOOKING_MARKED_EXPIRED', {
            bookingId: normalizedBookingId,
            adminId: auth.adminId,
            couponReleased: result.couponReleased,
            guestEmailSent: result.guestEmailSent,
        });

        return NextResponse.json({ ok: true, bookingId: normalizedBookingId, status: 'EXPIRED' });
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
