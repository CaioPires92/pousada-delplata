import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendBookingPendingEmail } from '@/lib/email';
import { expireStalePendingBookings } from '@/lib/expire-stale-bookings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000);
        let pendingEmailCount = 0;

        const pendingToNotify = await prisma.booking.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: quinzeMinutosAtras },
                pendingEmailSentAt: null,
            },
            include: { guest: true, roomType: true, payment: true },
        });

        for (const booking of pendingToNotify) {
            await sendBookingPendingEmail({
                guestName: booking.guest.name,
                guestEmail: booking.guest.email,
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
            })
                .then((r) => {
                    if (r && (r as any).success) pendingEmailCount++;
                })
                .catch(() => {});

            await prisma.booking.update({
                where: { id: booking.id },
                data: { pendingEmailSentAt: new Date() },
            });
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
            expiredEmailCount: expiration.alertCount,
            couponReleaseCount: expiration.couponReleaseCount,
        });
    } catch (error) {
        console.error('Erro no Cron:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
