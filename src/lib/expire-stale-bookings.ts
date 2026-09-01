import prisma from '@/lib/prisma';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';
import { sendBookingExpiredEmail } from '@/lib/email';

export function getPendingBookingExpirationHours() {
    return Math.max(1, Number.parseInt(process.env.PENDING_BOOKING_EXPIRATION_HOURS || '24', 10) || 24);
}

export function getTodayDateInSaoPauloAsUtcDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export async function expireStalePendingBookings(params: {
    source: string;
    sendAdminAlerts?: boolean;
    limit?: number;
}) {
    const expirationHours = getPendingBookingExpirationHours();
    const threshold = new Date(Date.now() - expirationHours * 60 * 60 * 1000);
    const limit = Math.max(1, Math.min(params.limit || 50, 200));

    const expiredBookings = await prisma.booking.findMany({
        where: {
            status: 'PENDING',
            createdAt: { lt: threshold },
        },
        include: {
            guest: true,
            roomType: true,
            payment: true,
        },
        orderBy: { checkIn: 'asc' },
        take: limit,
    });

    if (expiredBookings.length === 0) {
        return { expiredCount: 0, alertCount: 0, guestExpiredEmailCount: 0, couponReleaseCount: 0 };
    }

    const bookingIds = expiredBookings.map((booking) => booking.id);
    const expired = await prisma.booking.updateMany({
        where: {
            id: { in: bookingIds },
            status: 'PENDING',
        },
        data: {
            status: 'EXPIRED',
            funnelStage: 'EXPIRED_PENDING_BOOKING',
            funnelUpdatedAt: new Date(),
            lastErrorMessage: `pending_expired_after_${expirationHours}_hours`,
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
        for (const booking of expiredBookings) {
            await sendBookingExpiredEmail({
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
                funnelStage: 'EXPIRED_PENDING_BOOKING',
                lastErrorMessage: `pending_expired_after_${expirationHours}_hours`,
            }).catch((error) => {
                console.error(`[Expire Pending Bookings] Failed guest email (${params.source}):`, error);
            });
            await sendBookingStatusAlertEmail(booking, {
                bookingStatus: 'EXPIRED',
                paymentStatus: booking.payment?.status || 'PENDING',
            })
                .then((result) => {
                    if (result?.success) alertCount++;
                })
                .catch((error) => {
                    console.error(`[Expire Past Check-In Bookings] Failed status alert (${params.source}):`, error);
                });
        }
    }

    return {
        expiredCount: expired.count,
        alertCount,
        guestExpiredEmailCount: 0,
        couponReleaseCount: released.count,
    };
}
