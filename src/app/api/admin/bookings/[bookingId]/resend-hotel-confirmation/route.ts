import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import {
    sendBookingGuestConfirmationEmail,
    sendBookingStatusAlertEmail,
} from '@/lib/booking-status-alert';
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

        const emailStatus = {
            bookingStatus: 'CONFIRMED',
            paymentStatus: booking.payment?.status || 'APPROVED',
        };
        const [guestResult, hotelResult] = await Promise.all([
            sendBookingGuestConfirmationEmail(booking, emailStatus),
            sendBookingStatusAlertEmail(booking, emailStatus),
        ]);

        if (guestResult.success) {
            await prisma.booking.updateMany({
                where: { id: normalizedBookingId },
                data: { confirmationEmailSentAt: new Date() },
            });
        }

        if (!guestResult.success || !hotelResult.success) {
            opsLog('error', 'ADMIN_HOTEL_CONFIRMATION_RESEND_FAILED', {
                bookingId: normalizedBookingId,
                adminId: auth.adminId,
                guestSent: guestResult.success,
                hotelSent: hotelResult.success,
            });
            return NextResponse.json(
                {
                    error: 'BOOKING_CONFIRMATION_EMAIL_FAILED',
                    message: !guestResult.success && !hotelResult.success
                        ? 'Não foi possível enviar o voucher ao hóspede nem a confirmação à pousada.'
                        : !guestResult.success
                            ? 'A confirmação chegou à pousada, mas o voucher não pôde ser enviado ao hóspede.'
                            : 'O voucher chegou ao hóspede, mas a confirmação não pôde ser enviada à pousada.',
                    guestSent: guestResult.success,
                    hotelSent: hotelResult.success,
                },
                { status: 502 }
            );
        }

        opsLog('info', 'ADMIN_HOTEL_CONFIRMATION_RESENT', {
            bookingId: normalizedBookingId,
            adminId: auth.adminId,
            guestMessageId: guestResult.messageId,
            hotelMessageId: hotelResult.messageId,
        });

        return NextResponse.json({
            ok: true,
            bookingId: normalizedBookingId,
            guestSent: true,
            hotelSent: true,
            guestMessageId: guestResult.messageId,
            hotelMessageId: hotelResult.messageId,
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
