import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendBookingExpiredEmail, sendBookingPendingEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000);
        const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000);
        let pendingEmailCount = 0;
        let expiredEmailCount = 0;

        const pendingToNotify = await prisma.booking.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: quinzeMinutosAtras },
                pendingEmailSentAt: null,
            },
            include: { guest: true, roomType: true, payment: true },
        });

        for (const booking of pendingToNotify) {
            sendBookingPendingEmail({
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

        const pendingBookings = await prisma.booking.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: trintaMinutosAtras },
            },
            include: { guest: true, roomType: true, payment: true },
        });

        const pendingBookingIds = pendingBookings.map((b) => b.id);

        const result = await prisma.booking.updateMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: trintaMinutosAtras },
            },
            data: {
                status: 'EXPIRED',
            },
        });

        let couponReleaseCount = 0;
        if (pendingBookingIds.length > 0) {
            const released = await prisma.couponRedemption.updateMany({
                where: {
                    bookingId: { in: pendingBookingIds },
                    status: { in: ['RESERVED', 'CONFIRMED'] },
                },
                data: {
                    status: 'RELEASED',
                    releasedAt: new Date(),
                },
            });
            couponReleaseCount = released.count;
        }

        for (const booking of pendingBookings) {
            sendBookingExpiredEmail({
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
                    if (r && (r as any).success) expiredEmailCount++;
                })
                .catch(() => {});

            await prisma.booking.update({
                where: { id: booking.id },
                data: { expiredEmailSentAt: new Date() },
            });
        }

        console.log(
            `[Cron Cleanup] ${result.count} reservas expiradas. Emails pendentes: ${pendingEmailCount}, emails expirados: ${expiredEmailCount}, cupons liberados: ${couponReleaseCount}.`
        );
        return NextResponse.json({
            success: true,
            count: result.count,
            pendingEmailCount,
            expiredEmailCount,
            couponReleaseCount,
        });
    } catch (error) {
        console.error('Erro no Cron:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
