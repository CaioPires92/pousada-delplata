import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';
import { readAdminActionReason } from '@/lib/admin-action-reason';

export const runtime = 'nodejs';

function isManualTestPayment(payment: { provider?: string | null; method?: string | null; providerId?: string | null } | null | undefined) {
    if (!payment) return false;
    const provider = String(payment.provider || '').trim().toUpperCase();
    const method = String(payment.method || '').trim().toUpperCase();
    const providerId = String(payment.providerId || '').trim().toUpperCase();
    return provider === 'MANUAL_TEST' || method === 'MANUAL_TEST' || providerId.startsWith('TEST_');
}

export async function DELETE(
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
                    message: 'Informe o motivo para excluir a reserva.',
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

        const isApprovedPayment = String(booking.payment?.status || '').toUpperCase() === 'APPROVED';
        const allowApprovedDelete = isManualTestPayment(booking.payment);

        if (isApprovedPayment && !allowApprovedDelete) {
            return NextResponse.json(
                {
                    error: 'BOOKING_HAS_APPROVED_PAYMENT',
                    message: 'Nao e permitido excluir reserva com pagamento aprovado.',
                },
                { status: 409 }
            );
        }

        await prisma.$transaction([
            prisma.couponRedemption.updateMany({
                where: { bookingId },
                data: {
                    status: 'RELEASED',
                    bookingId: null,
                    releasedAt: new Date(),
                },
            }),
            prisma.payment.deleteMany({ where: { bookingId } }),
            prisma.booking.delete({ where: { id: bookingId } }),
        ]);

        opsLog('info', 'ADMIN_BOOKING_DELETED', {
            bookingId,
            adminId: auth.adminId,
            reason,
            hadApprovedPayment: isApprovedPayment,
            approvedPaymentWasManualTest: isApprovedPayment ? allowApprovedDelete : false,
        });

        return NextResponse.json({ ok: true, bookingId });
    } catch (error) {
        console.error('[Admin Booking Delete] Error:', error);
        return NextResponse.json(
            {
                error: 'BOOKING_DELETE_FAILED',
                message: 'Nao foi possivel excluir a reserva.',
            },
            { status: 500 }
        );
    }
}
