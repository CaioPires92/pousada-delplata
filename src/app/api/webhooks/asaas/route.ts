import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { ASAAS_MAX_INSTALLMENTS } from '@/lib/asaas/client';
import { hasRoomForBooking } from '@/lib/availability/room-check';
import { getRoomHoldEnd } from '@/lib/booking-payment-window';
import { isPaymentUnderReview } from '@/lib/mercadopago/payment-under-review';
import { sendBookingConfirmationEmail, sendBookingCreatedAlertEmail, sendDifficultyAlertEmail } from '@/lib/email';
import { opsLog } from '@/lib/ops-log';
import prisma from '@/lib/prisma';

type AsaasWebhook = {
    id?: string;
    event?: string;
    payment?: {
        id?: string;
        externalReference?: string;
        value?: number;
        netValue?: number;
        billingType?: string;
        status?: string;
        installmentNumber?: number;
        checkoutSession?: string;
    };
    checkout?: {
        id?: string;
        externalReference?: string;
        billingTypes?: string[];
        items?: Array<{ quantity?: number; value?: number }>;
    };
};

function tokensMatch(received: string, configured: string) {
    const receivedBuffer = Buffer.from(received);
    const configuredBuffer = Buffer.from(configured);
    return receivedBuffer.length === configuredBuffer.length
        && crypto.timingSafeEqual(receivedBuffer, configuredBuffer);
}

const APPROVED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'CHECKOUT_PAID']);
const CANCELLED_EVENTS = new Set([
    'PAYMENT_REFUNDED',
    'PAYMENT_DELETED',
    'PAYMENT_CHARGEBACK_REQUESTED',
    'CHECKOUT_CANCELED',
    'CHECKOUT_EXPIRED',
]);

const REVERSAL_EVENTS = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED']);

// Cartao retido na analise de risco do Asaas: a reserva nao deve expirar enquanto isso
// (ver expire-stale-bookings). A aprovacao chega depois como PAYMENT_CONFIRMED.
const RISK_ANALYSIS_PENDING_EVENTS = new Set(['PAYMENT_AWAITING_RISK_ANALYSIS']);
const RISK_ANALYSIS_REJECTED_EVENTS = new Set(['PAYMENT_REPROVED_BY_RISK_ANALYSIS']);

export async function POST(request: Request) {
    const configuredToken = String(process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
    const receivedToken = String(request.headers.get('asaas-access-token') || '').trim();
    if (!configuredToken) {
        opsLog('error', 'ASAAS_WEBHOOK_CONFIG_ERROR', { reason: 'MISSING_ASAAS_WEBHOOK_TOKEN' });
        return NextResponse.json({ error: 'Webhook não configurado' }, { status: 500 });
    }
    if (!receivedToken || !tokensMatch(receivedToken, configuredToken)) {
        opsLog('warn', 'ASAAS_WEBHOOK_INVALID_TOKEN', {});
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    let body: AsaasWebhook;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const event = String(body.event || '').toUpperCase();
    const paymentId = String(body.payment?.id || body.checkout?.id || '').trim();
    let bookingId = String(body.payment?.externalReference || body.checkout?.externalReference || '').trim();
    if (paymentId && !bookingId) {
        const providerIds = Array.from(new Set([
            paymentId,
            String(body.payment?.checkoutSession || '').trim(),
            String(body.checkout?.id || '').trim(),
        ].filter(Boolean)));
        const storedPayment = await prisma.payment.findFirst({
            where: { provider: 'ASAAS', providerId: { in: providerIds } },
            select: { bookingId: true },
        });
        bookingId = String(storedPayment?.bookingId || '').trim();
    }
    if (!paymentId || !bookingId) {
        opsLog('info', 'ASAAS_WEBHOOK_IGNORED', { event, reason: 'MISSING_REFERENCE' });
        return NextResponse.json({ status: 'ignored' });
    }

    const result = await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true, guest: true, roomType: true },
        });
        if (!booking) return null;

        const expectedAmount = Number(booking.payment?.amount ?? booking.totalPrice);
        const checkoutAmount = body.checkout?.items?.reduce((total, item) => (
            total + (Number(item.value) * Math.max(1, Number(item.quantity) || 1))
        ), 0);
        const receivedAmount = Number(body.payment?.value ?? checkoutAmount);
        // Cartao parcelado: o Asaas envia um PAYMENT_CONFIRMED por parcela, com o valor da PARCELA.
        // Aceita se couber entre total/maximo de parcelas e o total; o total segue validado no
        // CHECKOUT_PAID. Responder 422 aqui travava a fila sequencial do webhook.
        const isInstallmentEvent = Number(body.payment?.installmentNumber) > 0 && body.payment?.value != null;
        const amountMatches = isInstallmentEvent
            ? receivedAmount <= expectedAmount + 0.01 && receivedAmount >= expectedAmount / ASAAS_MAX_INSTALLMENTS - 0.05
            : Math.abs(receivedAmount - expectedAmount) <= 0.01;
        if (APPROVED_EVENTS.has(event) && (!Number.isFinite(receivedAmount) || !amountMatches)) {
            await tx.booking.update({
                where: { id: bookingId },
                data: { funnelStage: 'PAYMENT_VALIDATION_FAILED', funnelUpdatedAt: new Date(), lastErrorMessage: 'invalid_payment_amount' },
            });
            return { booking, confirmedNow: false, invalidAmount: true };
        }

        const method = String(
            body.payment?.billingType
            || (body.checkout?.billingTypes?.length === 1 ? body.checkout.billingTypes[0] : 'ASAAS_CHECKOUT')
        ).toUpperCase() || null;
        if (APPROVED_EVENTS.has(event)) {
            let confirmedNow = booking.status === 'PENDING';
            // Pago depois de a reserva expirar/cancelar (cartao aprovado apos analise etc.):
            // o dinheiro entrou mas a reserva nao confirma sozinha. Alerta so na primeira entrega.
            const approvedOnInactiveBooking = !confirmedNow
                && booking.status !== 'CONFIRMED'
                && booking.payment?.status !== 'APPROVED';
            // Dentro do bloqueio (prazo do link + folga) o quarto e garantido. Depois dele, e
            // antes de o cron marcar EXPIRED, so confirma se ainda houver quarto livre agora;
            // senao nao confirma (evita overbooking) e a equipe estorna ou realoca.
            let paidWithoutRoom = false;
            if (confirmedNow
                && getRoomHoldEnd(booking).getTime() < Date.now()
                && !isPaymentUnderReview(booking.payment)
                && !(await hasRoomForBooking(booking, tx))) {
                confirmedNow = false;
                paidWithoutRoom = true;
            }
            await tx.payment.upsert({
                where: { bookingId },
                update: { status: 'APPROVED', provider: 'ASAAS', providerId: paymentId, method },
                create: {
                    bookingId, amount: expectedAmount, totalAmount: Number(booking.totalPrice),
                    remainingAmount: 0, paymentMode: 'FULL', provider: 'ASAAS', providerId: paymentId,
                    method, status: 'APPROVED',
                },
            });
            if (confirmedNow) {
                await tx.booking.update({
                    where: { id: bookingId },
                    data: { status: 'CONFIRMED', funnelStage: 'BOOKING_CONFIRMED', funnelUpdatedAt: new Date(), lastErrorMessage: null },
                });
                await tx.couponRedemption.updateMany({
                    where: { bookingId, status: 'RESERVED' },
                    data: { status: 'CONFIRMED', confirmedAt: new Date() },
                });
            }
            if (paidWithoutRoom) {
                await tx.booking.update({
                    where: { id: bookingId },
                    data: {
                        status: 'EXPIRED',
                        funnelStage: 'PAID_WITHOUT_AVAILABILITY',
                        funnelUpdatedAt: new Date(),
                        lastErrorMessage: 'paid_after_deadline_no_availability',
                    },
                });
                await tx.couponRedemption.updateMany({
                    where: { bookingId, status: 'RESERVED' },
                    data: { status: 'RELEASED', releasedAt: new Date() },
                });
            }
            // installmentNumber e o numero DESTA parcela (1, 2, 3...), nao a quantidade.
            const installmentCount = isInstallmentEvent && receivedAmount > 0
                ? Math.max(1, Math.round(expectedAmount / receivedAmount))
                : null;
            return { booking, confirmedNow, invalidAmount: false, method, approvedOnInactiveBooking, paidWithoutRoom, installmentCount };
        }

        if (RISK_ANALYSIS_PENDING_EVENTS.has(event) || RISK_ANALYSIS_REJECTED_EVENTS.has(event)) {
            await tx.payment.updateMany({
                where: { bookingId, status: { not: 'APPROVED' } },
                data: {
                    status: RISK_ANALYSIS_PENDING_EVENTS.has(event) ? 'UNDER_REVIEW' : 'REJECTED',
                    providerId: paymentId,
                    method,
                },
            });
            return { booking, confirmedNow: false, invalidAmount: false, method };
        }

        if (CANCELLED_EVENTS.has(event)) {
            await tx.payment.updateMany({
                where: { bookingId, status: { not: 'APPROVED' } },
                data: { status: event === 'PAYMENT_REFUNDED' ? 'REFUNDED' : 'REJECTED', providerId: paymentId, method },
            });
            // Estorno/chargeback de um pagamento ja aprovado: reverte o pagamento e cancela a reserva.
            if (REVERSAL_EVENTS.has(event)) {
                const reversed = await tx.payment.updateMany({
                    where: { bookingId, status: 'APPROVED' },
                    data: { status: 'REFUNDED' },
                });
                if (reversed.count > 0 && booking.status === 'CONFIRMED') {
                    await tx.booking.update({
                        where: { id: bookingId },
                        data: {
                            status: 'CANCELLED',
                            funnelStage: 'BOOKING_CANCELLED',
                            funnelUpdatedAt: new Date(),
                            lastErrorMessage: event === 'PAYMENT_CHARGEBACK_REQUESTED'
                                ? 'asaas_payment_chargeback'
                                : 'asaas_payment_refunded',
                        },
                    });
                }
            }
            return { booking, confirmedNow: false, invalidAmount: false, method };
        }

        await tx.payment.updateMany({
            where: { bookingId, status: { not: 'APPROVED' } },
            data: { providerId: paymentId, method },
        });
        return { booking, confirmedNow: false, invalidAmount: false, method };
    });

    if (!result) return NextResponse.json({ status: 'ignored' });
    if (result.invalidAmount) return NextResponse.json({ error: 'Valor divergente' }, { status: 422 });

    if (result.confirmedNow) {
        const booking = result.booking;
        const confirmedEmailData = {
            guestName: booking.guest.name,
            guestEmail: booking.guest.email,
            guestPhone: booking.guest.phone || null,
            bookingId: booking.id,
            roomName: booking.roomType.name,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            totalPrice: Number(booking.totalPrice),
            paymentMethod: result.method,
            paymentInstallments: result.installmentCount ?? null,
            paymentMode: booking.payment?.paymentMode || 'FULL',
            paidAmount: Number(booking.payment?.amount ?? booking.totalPrice),
            remainingAmount: Number(booking.payment?.remainingAmount || 0),
            balanceDueAt: booking.payment?.balanceDueAt || null,
            balanceDueDate: booking.payment?.balanceDueDate || null,
            adults: booking.adults,
            children: booking.children,
            childrenAges: booking.childrenAges,
            pets: booking.pets,
            bookingStatus: 'CONFIRMED',
            paymentStatus: 'APPROVED',
            bookingCreatedAt: booking.createdAt,
        };
        const emailResult = await sendBookingConfirmationEmail(confirmedEmailData);
        // Aviso a equipe: unico e-mail interno de reserva nova (nao ha mais alerta de "pendente").
        await sendBookingCreatedAlertEmail(confirmedEmailData).catch((error) => {
            opsLog('error', 'ASAAS_CONFIRMED_ADMIN_ALERT_FAILED', {
                bookingId, message: error instanceof Error ? error.message : String(error),
            });
        });
        if (emailResult?.success) {
            await prisma.booking.updateMany({
                where: { id: bookingId, confirmationEmailSentAt: null },
                data: { confirmationEmailSentAt: new Date() },
            });
        }
    }

    if (result.approvedOnInactiveBooking) {
        const booking = result.booking;
        opsLog('error', 'ASAAS_PAYMENT_APPROVED_ON_INACTIVE_BOOKING', {
            bookingId, paymentId, bookingStatus: booking.status,
        });
        await sendDifficultyAlertEmail({
            guestName: booking.guest.name,
            guestEmail: booking.guest.email,
            guestPhone: booking.guest.phone,
            bookingId: booking.id,
            roomName: booking.roomType.name,
            totalPrice: Number(booking.totalPrice),
            step: 'Pagamento aprovado sem confirmação da reserva',
            reason: `O Asaas aprovou o pagamento, mas a reserva está com status ${booking.status}. Verifique disponibilidade e confirme ou estorne manualmente.`,
            paymentProviderId: paymentId,
        }).catch((error) => {
            opsLog('error', 'ASAAS_INACTIVE_BOOKING_ALERT_FAILED', {
                bookingId, message: error instanceof Error ? error.message : String(error),
            });
        });
    }

    if (result.paidWithoutRoom) {
        const booking = result.booking;
        opsLog('error', 'ASAAS_PAID_WITHOUT_AVAILABILITY', { bookingId, paymentId });
        await sendDifficultyAlertEmail({
            guestName: booking.guest.name,
            guestEmail: booking.guest.email,
            guestPhone: booking.guest.phone,
            bookingId: booking.id,
            roomName: booking.roomType.name,
            totalPrice: Number(booking.totalPrice),
            step: 'Pagamento recebido sem quarto disponível',
            reason: 'O pagamento chegou depois do prazo da reserva e o quarto já não está disponível. A reserva NÃO foi confirmada: fale com o hóspede para realocar ou estornar.',
            paymentProviderId: paymentId,
        }).catch((error) => {
            opsLog('error', 'ASAAS_PAID_WITHOUT_ROOM_ALERT_FAILED', {
                bookingId, message: error instanceof Error ? error.message : String(error),
            });
        });
    }

    opsLog('info', 'ASAAS_WEBHOOK_PROCESSED', { event, bookingId, paymentId });
    return NextResponse.json({ status: 'ok' });
}

export async function GET() {
    return NextResponse.json({ message: 'Webhook Asaas ativo' });
}
