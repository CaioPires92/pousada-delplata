import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';
import { opsLog } from '@/lib/ops-log';
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
            return NextResponse.json(
                { error: 'BOOKING_NOT_FOUND', message: 'Reserva não encontrada.' },
                { status: 404 }
            );
        }

        const bookingStatus = String(booking.status || '').toUpperCase();
        if (bookingStatus !== 'CONFIRMED') {
            return NextResponse.json(
                {
                    error: 'BOOKING_NOT_CONFIRMED',
                    message: 'A confirmação só pode ser reenviada para uma reserva confirmada.',
                },
                { status: 409 }
            );
        }

        const result = await sendBookingStatusAlertEmail(booking, {
            bookingStatus: 'CONFIRMED',
            paymentStatus: booking.payment?.status || 'APPROVED',
        });

        if (!result.success) {
            opsLog('error', 'ADMIN_HOTEL_CONFIRMATION_RESEND_FAILED', {
                bookingId: normalizedBookingId,
                adminId: auth.adminId,
                error: result.error instanceof Error ? result.error.message : String(result.error),
            });
            return NextResponse.json(
                {
                    error: 'HOTEL_CONFIRMATION_EMAIL_FAILED',
                    message: 'Não foi possível enviar a confirmação ao hotel. Verifique a configuração do e-mail.',
                },
                { status: 502 }
            );
        }

        opsLog('info', 'ADMIN_HOTEL_CONFIRMATION_RESENT', {
            bookingId: normalizedBookingId,
            adminId: auth.adminId,
            messageId: result.messageId,
        });

        return NextResponse.json({
            ok: true,
            bookingId: normalizedBookingId,
            messageId: result.messageId,
        });
    } catch (error) {
        opsLog('error', 'ADMIN_HOTEL_CONFIRMATION_RESEND_UNEXPECTED_ERROR', {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            {
                error: 'HOTEL_CONFIRMATION_RESEND_FAILED',
                message: 'Não foi possível reenviar a confirmação ao hotel.',
            },
            { status: 500 }
        );
    }
}
