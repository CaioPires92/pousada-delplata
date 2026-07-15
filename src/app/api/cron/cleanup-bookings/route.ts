import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendBookingConfirmationEmail, sendBookingPendingEmail } from '@/lib/email';
import { expireStalePendingBookings } from '@/lib/expire-stale-bookings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000);
        const pendingTtlMinutes = Math.max(
            1,
            Number.parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30
        );
        const expirationThreshold = new Date(Date.now() - pendingTtlMinutes * 60 * 1000);
        let pendingEmailCount = 0;
        let confirmationEmailCount = 0;

        const confirmedWithoutEmail = await prisma.booking.findMany({
            where: {
                status: 'CONFIRMED',
                confirmationEmailSentAt: null,
                payment: { status: 'APPROVED' },
            },
            include: { guest: true, roomType: true, payment: true },
            orderBy: { createdAt: 'asc' },
            take: 50,
        });

        for (const booking of confirmedWithoutEmail) {
            const result = await sendBookingConfirmationEmail({
                guestName: booking.guest.name,
                guestEmail: booking.guest.email,
                guestPhone: booking.guest.phone,
                bookingId: booking.id,
                roomName: booking.roomType.name,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                totalPrice: Number(booking.totalPrice),
                paymentMethod: booking.payment?.method || null,
                paymentInstallments: booking.payment?.installments ?? null,
                paymentMode: booking.payment?.paymentMode || null,
                paidAmount: Number(booking.payment?.amount || 0),
                remainingAmount: Number(booking.payment?.remainingAmount || 0),
                balanceDueAt: booking.payment?.balanceDueAt || null,
                balanceDueDate: booking.payment?.balanceDueDate || null,
                adults: booking.adults,
                children: booking.children,
                childrenAges: booking.childrenAges,
                bookingStatus: booking.status,
                paymentStatus: booking.payment?.status || null,
                bookingCreatedAt: booking.createdAt,
            }).catch((error) => ({ success: false, error }));

            if (result?.success) {
                confirmationEmailCount++;
                await prisma.booking.updateMany({
                    where: { id: booking.id, confirmationEmailSentAt: null },
                    data: { confirmationEmailSentAt: new Date() },
                });
            }
        }

        const pendingToNotify = await prisma.booking.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: quinzeMinutosAtras, gte: expirationThreshold },
                pendingEmailSentAt: null,
            },
            include: { guest: true, roomType: true, payment: true },
        });

        for (const booking of pendingToNotify) {
            const result = await sendBookingPendingEmail({
                guestName: booking.guest.name,
                guestEmail: booking.guest.email,
                guestPhone: booking.guest.phone,
                bookingId: booking.id,
                roomName: booking.roomType.name,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                totalPrice: Number(booking.totalPrice),
                paymentMethod: booking.payment?.method || null,
                paymentInstallments: booking.payment?.installments ?? null,
                adults: booking.adults,
                children: booking.children,
                childrenAges: booking.childrenAges,
                funnelStage: booking.funnelStage,
                lastErrorMessage: booking.lastErrorMessage,
            }).catch((error) => ({ success: false, error }));

            if (result?.success) {
                pendingEmailCount++;
                await prisma.booking.update({
                    where: { id: booking.id },
                    data: { pendingEmailSentAt: new Date() },
                });
            } else {
                console.error(`[Cron Cleanup] Falha no email de recuperacao da reserva ${booking.id.slice(0, 8)}.`);
            }
        }

        const expiration = await expireStalePendingBookings({
            source: 'cron_cleanup_bookings',
            sendAdminAlerts: true,
            limit: 200,
        });

        console.log(
            `[Cron Cleanup] ${expiration.expiredCount} reservas expiradas. Emails pendentes: ${pendingEmailCount}, alertas expirados: ${expiration.alertCount}, cupons liberados: ${expiration.couponReleaseCount}.`
        );
        return NextResponse.json({
            success: true,
            count: expiration.expiredCount,
            pendingEmailCount,
            confirmationEmailCount,
            expiredEmailCount: expiration.guestExpiredEmailCount,
            couponReleaseCount: expiration.couponReleaseCount,
        });
    } catch (error) {
        console.error('Erro no Cron:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
