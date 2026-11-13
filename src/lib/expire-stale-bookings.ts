import type { Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';
import { sendBookingExpiredEmail } from '@/lib/email';
import { pastHoldPendingWhere } from '@/lib/booking-payment-window';
import { findBookingIdsWithPaymentUnderReview } from '@/lib/mercadopago/payment-under-review';


type MaintenanceBooking = Prisma.BookingGetPayload<{
    include: { guest: true; roomType: true; payment: true };
}>;

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

function toGuestEmailData(booking: MaintenanceBooking, overrides: { funnelStage: string | null; lastErrorMessage: string | null }) {
    return {
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
        pets: booking.pets,
        ...overrides,
    };
}

/**
 * Expira uma reserva e executa os efeitos (cupom, e-mail ao hóspede, alerta) somente se
 * esta chamada fez a transição — duas execuções simultâneas não duplicam e-mails.
 */
export async function expireBooking(booking: MaintenanceBooking, options: {
    source: string;
    expectedStatus: string;
    reason: string;
    sendGuestEmail: boolean;
    sendAdminAlert: boolean;
}) {
    const updated = await prisma.booking.updateMany({
        where: { id: booking.id, status: options.expectedStatus },
        data: {
            status: 'EXPIRED',
            funnelStage: 'EXPIRED_PENDING_BOOKING',
            funnelUpdatedAt: new Date(),
            lastErrorMessage: options.reason,
        },
    });
    if (updated.count !== 1) {
        return { expired: false, couponReleased: false, guestEmailSent: false, adminAlertSent: false };
    }

    const released = await prisma.couponRedemption.updateMany({
        where: { bookingId: booking.id, status: { in: ['RESERVED', 'CONFIRMED'] } },
        data: { status: 'RELEASED', releasedAt: new Date() },
    });

    let guestEmailSent = false;
    // Check-in já passou: "chame no WhatsApp para ver disponibilidade" não faz sentido.
    const checkInStillAhead = booking.checkIn.getTime() >= getTodayDateInSaoPauloAsUtcDate().getTime();
    if (options.sendGuestEmail && checkInStillAhead) {
        const claim = await prisma.booking.updateMany({
            where: { id: booking.id, expiredEmailSentAt: null },
            data: { expiredEmailSentAt: new Date() },
        });
        if (claim.count === 1) {
            const result = await sendBookingExpiredEmail(toGuestEmailData(booking, {
                funnelStage: 'EXPIRED_PENDING_BOOKING',
                lastErrorMessage: options.reason,
            })).catch(() => ({ success: false }));
            guestEmailSent = Boolean(result?.success);
            if (!guestEmailSent) {
                await prisma.booking.updateMany({
                    where: { id: booking.id },
                    data: { expiredEmailSentAt: null },
                });
                opsLog('warn', 'BOOKING_EXPIRED_EMAIL_FAILED', { bookingId: booking.id, source: options.source });
            }
        }
    }

    let adminAlertSent = false;
    if (options.sendAdminAlert) {
        const result = await sendBookingStatusAlertEmail(booking, {
            bookingStatus: 'EXPIRED',
            paymentStatus: booking.payment?.status || 'PENDING',
        }).catch(() => ({ success: false }));
        adminAlertSent = Boolean(result?.success);
    }

    return { expired: true, couponReleased: released.count > 0, guestEmailSent, adminAlertSent };
}

export async function expireStalePendingBookings(params: {
    source: string;
    sendAdminAlerts?: boolean;
    limit?: number;
}) {
    const limit = Math.max(1, Math.min(params.limit || 50, 200));

    // Só depois do bloqueio do quarto (prazo do link + folga): ver booking-payment-window.
    const candidates = await prisma.booking.findMany({
        where: pastHoldPendingWhere(),
        include: { guest: true, roomType: true, payment: true },
        orderBy: { checkIn: 'asc' },
        take: limit,
    });

    const summary = {
        expiredCount: 0,
        alertCount: 0,
        guestExpiredEmailCount: 0,
        couponReleaseCount: 0,
        skippedUnderReviewCount: 0,
    };
    if (candidates.length === 0) return summary;

    // Cartão em análise pode ser aprovado em até 3 dias: expirar no meio gera
    // "pagamento aprovado em reserva expirada".
    const underReview = await findBookingIdsWithPaymentUnderReview(candidates.map((booking) => booking.id));

    for (const booking of candidates) {
        if (underReview.has(booking.id)) {
            summary.skippedUnderReviewCount++;
            continue;
        }
        const result = await expireBooking(booking, {
            source: params.source,
            expectedStatus: 'PENDING',
            reason: 'payment_deadline_passed',
            sendGuestEmail: true,
            sendAdminAlert: Boolean(params.sendAdminAlerts),
        });
        if (!result.expired) continue;
        summary.expiredCount++;
        if (result.couponReleased) summary.couponReleaseCount++;
        if (result.guestEmailSent) summary.guestExpiredEmailCount++;
        if (result.adminAlertSent) summary.alertCount++;
    }

    return summary;
}

export async function runPendingBookingMaintenance(params: { source: string; sendAdminAlerts?: boolean }) {
    // Sem lembrete de "reserva pendente": com prazo curto, a recuperação é o e-mail de
    // "reserva expirada" (enviado aqui), que leva o hóspede a refazer a reserva ou ao WhatsApp.
    const expiration = await expireStalePendingBookings({ source: params.source, sendAdminAlerts: params.sendAdminAlerts });
    opsLog('info', 'PENDING_BOOKING_MAINTENANCE', { source: params.source, ...expiration });
    return { expiration };
}

// O plano Hobby da Vercel só permite um cron diário. Para a expiração sair perto do
// horário certo, a rotina também roda de carona no tráfego (nova reserva),
// no máximo uma vez a cada 10 minutos por instância. Todas as etapas são idempotentes.
const OPPORTUNISTIC_INTERVAL_MS = 10 * 60 * 1000;
let lastOpportunisticRunAt = 0;

export async function runPendingBookingMaintenanceThrottled(source: string) {
    const now = Date.now();
    if (now - lastOpportunisticRunAt < OPPORTUNISTIC_INTERVAL_MS) return null;
    lastOpportunisticRunAt = now;
    try {
        return await runPendingBookingMaintenance({ source, sendAdminAlerts: true });
    } catch (error) {
        opsLog('warn', 'PENDING_BOOKING_MAINTENANCE_FAILED', {
            source,
            message: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
