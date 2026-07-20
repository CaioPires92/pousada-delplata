import prisma from '@/lib/prisma';
import { sendAdminRecoveryAlertEmail } from '@/lib/email';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';

const INVENTORY_RELEASED_STAGE = 'INVENTORY_RELEASED';

export function getPendingBookingHoldTtlMinutes() {
    return Math.max(1, Number.parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '15', 10) || 15);
}

export function getPendingBookingReminderMinutes() {
    const ttlMinutes = getPendingBookingHoldTtlMinutes();
    const configured = Math.max(
        1,
        Number.parseInt(process.env.PENDING_BOOKING_REMINDER_MINUTES || '10', 10) || 10
    );
    return Math.min(configured, Math.max(1, ttlMinutes - 1));
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

export async function releaseStalePendingBookingHolds(params: {
    source: string;
    sendAdminAlerts?: boolean;
    limit?: number;
}) {
    const ttlMinutes = getPendingBookingHoldTtlMinutes();
    const threshold = new Date(Date.now() - ttlMinutes * 60 * 1000);
    const today = getTodayDateInSaoPauloAsUtcDate();
    const limit = Math.max(1, Math.min(params.limit || 50, 200));

    const staleBookings = await prisma.booking.findMany({
        where: {
            status: 'PENDING',
            createdAt: { lt: threshold },
            checkIn: { gte: today },
            OR: [
                { funnelStage: null },
                { NOT: { funnelStage: INVENTORY_RELEASED_STAGE } },
            ],
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
        return { holdReleasedCount: 0, alertCount: 0, couponReleaseCount: 0 };
    }

    const bookingIds = staleBookings.map((booking) => booking.id);
    const releasedHolds = await prisma.booking.updateMany({
        where: {
            id: { in: bookingIds },
            status: 'PENDING',
        },
        data: {
            funnelStage: INVENTORY_RELEASED_STAGE,
            funnelUpdatedAt: new Date(),
            lastErrorMessage: `inventory_released_after_${ttlMinutes}_minutes`,
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
                bookingStatus: 'PENDING',
                paymentStatus: booking.payment?.status || 'PENDING',
            })
                .then((result) => {
                    if (result?.success) alertCount++;
                })
                .catch((error) => {
                    console.error(`[Release Pending Booking Hold] Failed status alert (${params.source}):`, error);
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
                console.error(`[Release Pending Booking Hold] Failed recovery alert (${params.source}):`, error);
            });
        }
    }

    return {
        holdReleasedCount: releasedHolds.count,
        alertCount,
        couponReleaseCount: released.count,
    };
}

export async function expirePastCheckInPendingBookings(params: {
    source: string;
    sendAdminAlerts?: boolean;
    limit?: number;
}) {
    const today = getTodayDateInSaoPauloAsUtcDate();
    const limit = Math.max(1, Math.min(params.limit || 50, 200));

    const expiredBookings = await prisma.booking.findMany({
        where: {
            status: 'PENDING',
            checkIn: { lt: today },
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
            funnelStage: 'EXPIRED_CHECK_IN_PASSED',
            funnelUpdatedAt: new Date(),
            lastErrorMessage: 'check_in_date_passed',
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
