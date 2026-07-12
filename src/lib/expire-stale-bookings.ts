import prisma from '@/lib/prisma';
import { sendAdminRecoveryAlertEmail } from '@/lib/email';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';

function getPendingBookingTtlMinutes() {
    return Math.max(1, Number.parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '30', 10) || 30);
}

export async function expireStalePendingBookings(params: {
    source: string;
    sendAdminAlerts?: boolean;
    limit?: number;
}) {
    const ttlMinutes = getPendingBookingTtlMinutes();
    const threshold = new Date(Date.now() - ttlMinutes * 60 * 1000);
    const limit = Math.max(1, Math.min(params.limit || 50, 200));

    const staleBookings = await prisma.booking.findMany({
        where: {
            status: 'PENDING',
            createdAt: { lt: threshold },
        },
        include: {
            guest: true,
            roomType: true,
            payment: true,
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
    });

    if (staleBookings.length === 0) {
        return { expiredCount: 0, alertCount: 0, couponReleaseCount: 0 };
    }

    const bookingIds = staleBookings.map((booking) => booking.id);
    const expired = await prisma.booking.updateMany({
        where: {
            id: { in: bookingIds },
            status: 'PENDING',
        },
        data: {
            status: 'EXPIRED',
            funnelStage: 'EXPIRED_UNPAID',
            funnelUpdatedAt: new Date(),
            lastErrorMessage: `expired_after_${ttlMinutes}_minutes`,
        },
    });

    const released = await prisma.couponRedemption.updateMany({
        where: {
            bookingId: { in: bookingIds },
            status: { in: ['RESERVED', 'CONFIRMED'] },
        },
        data: {
            status: 'RELEASED',
            releasedAt: new Date(),
        },
    });

    let alertCount = 0;
    if (params.sendAdminAlerts) {
        for (const booking of staleBookings) {
            await sendBookingStatusAlertEmail(booking, {
                bookingStatus: 'EXPIRED',
                paymentStatus: booking.payment?.status || 'PENDING',
            })
                .then((result) => {
                    if (result?.success) alertCount++;
                })
                .catch((error) => {
                    console.error(`[Expire Stale Bookings] Failed status alert (${params.source}):`, error);
                });

            await sendAdminRecoveryAlertEmail({
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
            }).catch((error) => {
                console.error(`[Expire Stale Bookings] Failed recovery alert (${params.source}):`, error);
            });
        }
    }

    if (params.sendAdminAlerts && expired.count > 0) {
        await prisma.booking.updateMany({
            where: {
                id: { in: bookingIds },
                status: 'EXPIRED',
            },
            data: {
                expiredEmailSentAt: new Date(),
            },
        });
    }

    return {
        expiredCount: expired.count,
        alertCount,
        couponReleaseCount: released.count,
    };
}

