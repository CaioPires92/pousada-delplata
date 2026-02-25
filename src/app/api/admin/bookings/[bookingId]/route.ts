import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';

export const runtime = 'nodejs';

type DeleteBody = {
    confirmDelete?: unknown;
    confirmApprovedDelete?: unknown;
};

async function readDeleteBody(request: Request): Promise<DeleteBody> {
    try {
        const contentType = String(request.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('application/json')) return {};
        const body = await request.json().catch(() => ({}));
        return typeof body === 'object' && body !== null ? (body as DeleteBody) : {};
    } catch {
        return {};
    }
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

        const body = await readDeleteBody(request);
        const confirmDelete = body.confirmDelete === true;
        const confirmApprovedDelete = body.confirmApprovedDelete === true;

        if (!confirmDelete) {
            return NextResponse.json(
                {
                    error: 'DELETE_CONFIRMATION_REQUIRED',
                    message: 'Confirmação de exclusão obrigatória.',
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
        if (isApprovedPayment && !confirmApprovedDelete) {
            return NextResponse.json(
                {
                    error: 'APPROVED_DELETE_CONFIRMATION_REQUIRED',
                    message: 'Esta reserva possui pagamento aprovado. Confirme novamente para excluir.',
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
            hadApprovedPayment: isApprovedPayment,
            confirmedByAdmin: true,
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
