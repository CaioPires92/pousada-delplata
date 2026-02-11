import crypto from 'crypto';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';

type MercadoPagoWebhookBody = {
    type?: string;
    data?: { id?: string | number };
};

function validateSignature(params: {
    signature: string | null;
    requestId: string | null;
    webhookSecret: string | undefined;
    paymentId: string;
}) {
    const { signature, requestId, webhookSecret, paymentId } = params;
    if (!webhookSecret) return { ok: true as const };
    if (!signature || !requestId) return { ok: false as const, reason: 'Missing signature headers' };

    const parts = signature.split(',');
    let ts = '';
    let hash = '';

    for (const part of parts) {
        const [key, value] = part.trim().split('=');
        if (key === 'ts') ts = value;
        if (key === 'v1') hash = value;
    }

    if (!ts || !hash) return { ok: false as const, reason: 'Invalid signature format' };

    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
    if (hmac !== hash) return { ok: false as const, reason: 'Invalid signature' };
    return { ok: true as const };
}

function mapPaymentStatus(mpStatus: string | null | undefined) {
    const s = (mpStatus || '').toLowerCase();
    if (s === 'approved') {
        return { bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED' } as const;
    }
    if (s === 'rejected' || s === 'cancelled') {
        return { bookingStatus: 'CANCELLED', paymentStatus: 'REJECTED' } as const;
    }
    if (s === 'refunded' || s === 'charged_back') {
        return { bookingStatus: 'CANCELLED', paymentStatus: 'REFUNDED' } as const;
    }
    return { bookingStatus: 'PENDING', paymentStatus: 'PENDING' } as const;
}

export async function handleMercadoPagoWebhook(request: Request) {
    let ctxPaymentId: string | undefined;
    let ctxBookingId: string | undefined;
    try {
        const rawBody = await request.text();
        if (!rawBody) return NextResponse.json({ error: 'Empty body' }, { status: 400 });

        const body = JSON.parse(rawBody) as MercadoPagoWebhookBody;
        const type = body.type;
        const paymentIdRaw = body.data?.id;

        if (type !== 'payment') {
            opsLog('info', 'MP_WEBHOOK_IGNORED', { type });
            return NextResponse.json({ status: 'ignored', type });
        }
        if (!paymentIdRaw) {
            opsLog('warn', 'MP_WEBHOOK_INVALID', { reason: 'MISSING_PAYMENT_ID' });
            return NextResponse.json({ error: 'ID de pagamento ausente' }, { status: 400 });
        }

        const paymentId = String(paymentIdRaw);
        ctxPaymentId = paymentId;

        const signature = request.headers.get('x-signature');
        const requestId = request.headers.get('x-request-id');
        const sigResult = validateSignature({
            signature,
            requestId,
            webhookSecret: process.env.MP_WEBHOOK_SECRET,
            paymentId,
        });
        if (!sigResult.ok) {
            opsLog('warn', 'MP_WEBHOOK_INVALID', { reason: 'INVALID_SIGNATURE', paymentId });
            return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
        }

        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            opsLog('error', 'MP_WEBHOOK_CONFIG_ERROR', { reason: 'MISSING_MP_ACCESS_TOKEN', paymentId });
            return NextResponse.json({ error: 'Mercado Pago não configurado' }, { status: 500 });
        }

        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!paymentResponse.ok) {
            opsLog('error', 'MP_WEBHOOK_MP_FETCH_FAILED', { paymentId, status: paymentResponse.status });
            return NextResponse.json(
                { error: 'Falha ao buscar pagamento', status: paymentResponse.status },
                { status: 502 }
            );
        }

        const paymentData = await paymentResponse.json();
        const mpStatus = paymentData?.status as string | undefined;
        const bookingId = paymentData?.external_reference as string | undefined;
        ctxBookingId = bookingId;

        if (!bookingId) {
            opsLog('warn', 'MP_WEBHOOK_INVALID', { reason: 'MISSING_BOOKING_REFERENCE', paymentId });
            return NextResponse.json({ error: 'Referência de reserva ausente' }, { status: 400 });
        }

        const mapped = mapPaymentStatus(mpStatus);

        const result = await prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findUnique({
                where: { id: bookingId },
                include: { payment: true, guest: true, roomType: true },
            });
            if (!booking) return { kind: 'not_found' as const };

            const currentBookingStatus = booking.status;
            const currentPaymentStatus = booking.payment?.status;

            let bookingStatus = currentBookingStatus;
            let paymentStatus = currentPaymentStatus || 'PENDING';
            let emailQueued = false;

            if (mapped.bookingStatus === 'CONFIRMED') {
                if (currentBookingStatus === 'PENDING') {
                    const update = await tx.booking.updateMany({
                        where: { id: bookingId, status: 'PENDING' },
                        data: { status: 'CONFIRMED' },
                    });
                    if (update.count === 1) {
                        bookingStatus = 'CONFIRMED';
                        emailQueued = true;
                    }
                }
                if (currentBookingStatus === 'CONFIRMED') {
                    bookingStatus = 'CONFIRMED';
                }
            }

            if (mapped.bookingStatus === 'CANCELLED') {
                if (currentBookingStatus === 'PENDING') {
                    const update = await tx.booking.updateMany({
                        where: { id: bookingId, status: 'PENDING' },
                        data: { status: 'CANCELLED' },
                    });
                    if (update.count === 1) bookingStatus = 'CANCELLED';
                }
                if (mapped.paymentStatus === 'REFUNDED' && currentBookingStatus === 'CONFIRMED') {
                    const update = await tx.booking.updateMany({
                        where: { id: bookingId, status: 'CONFIRMED' },
                        data: { status: 'CANCELLED' },
                    });
                    if (update.count === 1) bookingStatus = 'CANCELLED';
                }
                if (currentBookingStatus === 'CANCELLED') {
                    bookingStatus = 'CANCELLED';
                }
                if (currentBookingStatus === 'CONFIRMED' && mapped.paymentStatus !== 'REFUNDED') {
                    bookingStatus = 'CONFIRMED';
                }
            }

            if (booking.payment) {
                if (mapped.paymentStatus === 'APPROVED') {
                    if (booking.payment.status !== 'APPROVED') {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id, status: { not: 'APPROVED' } },
                            data: { status: 'APPROVED', providerId: paymentId },
                        });
                    } else if (booking.payment.providerId !== paymentId) {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id },
                            data: { providerId: paymentId },
                        });
                    }
                    paymentStatus = 'APPROVED';
                } else if (mapped.paymentStatus === 'REJECTED') {
                    if (booking.payment.status !== 'APPROVED' && booking.payment.status !== 'REJECTED') {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id, status: { notIn: ['APPROVED', 'REJECTED'] } },
                            data: { status: 'REJECTED', providerId: paymentId },
                        });
                        paymentStatus = 'REJECTED';
                    } else {
                        paymentStatus = booking.payment.status;
                    }
                } else if (mapped.paymentStatus === 'REFUNDED') {
                    if (booking.payment.status !== 'REFUNDED') {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id, status: { not: 'REFUNDED' } },
                            data: { status: 'REFUNDED', providerId: paymentId },
                        });
                    }
                    paymentStatus = 'REFUNDED';
                } else {
                    if (booking.payment.providerId !== paymentId) {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id },
                            data: { providerId: paymentId },
                        });
                    }
                    paymentStatus = booking.payment.status;
                }
            } else {
                const initialStatus = mapped.paymentStatus;
                await tx.payment.create({
                    data: {
                        bookingId,
                        amount: booking.totalPrice,
                        provider: 'MERCADOPAGO',
                        providerId: paymentId,
                        status: initialStatus,
                    },
                });
                paymentStatus = initialStatus;
            }

            return {
                kind: 'ok' as const,
                booking,
                bookingStatus,
                paymentStatus,
                emailQueued,
            };
        });

        if (result.kind === 'not_found') {
            opsLog('warn', 'MP_WEBHOOK_BOOKING_NOT_FOUND', {
                bookingId,
                bookingIdShort: bookingId.slice(0, 8),
                paymentId,
            });
            return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
        }

        let emailSent = false;
        let emailErrorMessage: string | undefined;
        if (result.emailQueued && mpStatus === 'approved') {
            const { sendBookingConfirmationEmail } = await import('@/lib/email');
            const emailResult = await sendBookingConfirmationEmail({
                guestName: result.booking.guest.name,
                guestEmail: result.booking.guest.email,
                bookingId: result.booking.id,
                roomName: result.booking.roomType.name,
                checkIn: result.booking.checkIn,
                checkOut: result.booking.checkOut,
                totalPrice: Number(result.booking.totalPrice),
            });

            emailSent = Boolean(emailResult?.success);
            if (!emailSent) {
                emailErrorMessage =
                    emailResult?.error instanceof Error
                        ? emailResult.error.message
                        : typeof emailResult?.error === 'string'
                            ? emailResult.error
                            : 'email_send_failed';

                opsLog('error', 'MP_WEBHOOK_EMAIL_FAILED', {
                    bookingId,
                    bookingIdShort: bookingId.slice(0, 8),
                    paymentId,
                    mpStatus,
                    error: emailErrorMessage,
                });
            }
        }

        opsLog('info', 'MP_WEBHOOK_PROCESSED', {
            bookingId,
            bookingIdShort: bookingId.slice(0, 8),
            paymentId,
            mpStatus,
            bookingStatus: result.bookingStatus,
            paymentStatus: result.paymentStatus,
            emailQueued: result.emailQueued,
            emailSent,
            emailErrorMessage,
        });
        return NextResponse.json({
            ok: true,
            bookingId,
            mpStatus,
            bookingStatus: result.bookingStatus,
            paymentStatus: result.paymentStatus,
            emailQueued: result.emailQueued,
            emailSent,
            emailErrorMessage,
        });
    } catch (error) {
        Sentry.captureException(error);
        opsLog('error', 'MP_WEBHOOK_ERROR', {
            paymentId: ctxPaymentId,
            bookingId: ctxBookingId,
            bookingIdShort: typeof ctxBookingId === 'string' ? ctxBookingId.slice(0, 8) : undefined,
            message: error instanceof Error ? error.message : 'Erro ao processar webhook',
        });
        const message = error instanceof Error ? error.message : 'Erro ao processar webhook';
        return NextResponse.json({ error: 'Erro ao processar webhook', message }, { status: 500 });
    }
}


