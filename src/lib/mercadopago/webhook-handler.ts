import crypto from 'crypto';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';
import { hasRoomForBooking } from '@/lib/availability/room-check';
import { getRoomHoldEnd } from '@/lib/booking-payment-window';
import { PAYMENT_UNDER_REVIEW_STATUSES } from '@/lib/mercadopago/payment-under-review';
import { sendGa4PurchaseServerEvent } from '@/lib/ga4-measurement';
import {
    mapMercadoPagoPaymentStatus,
    validateApprovedPaymentAmount,
} from '@/lib/mercadopago/payment-context';

type MercadoPagoWebhookBody = {
    type?: string;
    data?: { id?: string | number };
};

export function validateMercadoPagoWebhookSignature(params: {
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
    const expected = Buffer.from(hmac, 'hex');
    const received = Buffer.from(hash, 'hex');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
        return { ok: false as const, reason: 'Invalid signature' };
    }
    return { ok: true as const };
}

export function getMercadoPagoWebhookSignatureDataId(requestUrl: string) {
    try {
        return String(new URL(requestUrl).searchParams.get('data.id') || '').trim().toLowerCase();
    } catch {
        return '';
    }
}

function normalizeInstallments(value: unknown) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function normalizeCardBrand(params: {
    paymentMethodId: unknown;
    paymentTypeId: unknown;
}) {
    const paymentMethodId = String(params.paymentMethodId || '').trim().toLowerCase();
    const paymentTypeId = String(params.paymentTypeId || '').trim().toLowerCase();

    if (!paymentMethodId) return null;
    if (paymentTypeId !== 'credit_card' && paymentTypeId !== 'debit_card') return null;
    if (paymentMethodId === 'credit_card' || paymentMethodId === 'debit_card') return null;

    return paymentMethodId.toUpperCase();
}

function normalizePaymentMethod(params: {
    paymentMethodId: unknown;
    paymentTypeId: unknown;
    installments: number | null;
}) {
    const paymentMethodId = String(params.paymentMethodId || '').trim().toLowerCase();
    const paymentTypeId = String(params.paymentTypeId || '').trim().toLowerCase();
    const installments = params.installments;

    if (paymentMethodId === 'pix') return 'PIX';
    if (paymentTypeId === 'debit_card' || paymentMethodId === 'debit_card') return 'DEBIT_CARD';
    if (paymentTypeId === 'credit_card' || paymentMethodId === 'credit_card' || (installments !== null && installments >= 1)) {
        return 'CREDIT_CARD';
    }
    if (paymentTypeId === 'account_money' || paymentMethodId === 'account_money') return 'ACCOUNT_MONEY';
    return paymentMethodId ? paymentMethodId.toUpperCase() : null;
}

async function recordPaymentAttempt(params: {
    bookingId: string;
    paymentId: string;
    paymentData: any;
    method: string | null;
    cardBrand: string | null;
    installments: number | null;
}) {
    const amount = Number(params.paymentData?.transaction_amount);
    try {
        await prisma.paymentAttempt.upsert({
            where: { providerPaymentId: params.paymentId },
            update: {
                status: String(params.paymentData?.status || 'unknown').toUpperCase(),
                statusDetail: String(params.paymentData?.status_detail || '').trim() || null,
                method: params.method,
                cardBrand: params.cardBrand,
                installments: params.installments,
            },
            create: {
                bookingId: params.bookingId,
                provider: 'MERCADOPAGO',
                providerPaymentId: params.paymentId,
                amount: Number.isFinite(amount) ? amount : null,
                currency: String(params.paymentData?.currency_id || '').trim().toUpperCase() || null,
                method: params.method,
                cardBrand: params.cardBrand,
                installments: params.installments,
                status: String(params.paymentData?.status || 'unknown').toUpperCase(),
                statusDetail: String(params.paymentData?.status_detail || '').trim() || null,
            },
        });
    } catch (error) {
        // Keeps webhook reconciliation compatible until the migration is applied.
        opsLog('warn', 'MP_PAYMENT_ATTEMPT_HISTORY_FAILED', {
            bookingId: params.bookingId,
            bookingIdShort: params.bookingId.slice(0, 8),
            paymentId: params.paymentId,
            message: error instanceof Error ? error.message : String(error),
        });
    }
}

// Status previously recorded for this exact MP payment id; null when unknown or when
// the attempt history table is unavailable. Used only to avoid repeating alerts.
async function getPreviousAttemptStatus(paymentId: string) {
    try {
        const attempt = await prisma.paymentAttempt.findUnique({
            where: { providerPaymentId: paymentId },
            select: { status: true },
        });
        return attempt?.status ? String(attempt.status).toUpperCase() : null;
    } catch {
        return null;
    }
}

function normalizeFinancialSnapshot(params: {
    totalPrice: number;
    subtotalPrice: number | null;
    discountAmount: number | null;
    appliedCouponCode: string | null;
    redemptionDiscountAmount: number;
    redemptionCodePrefix?: string | null;
}) {
    const {
        totalPrice,
        subtotalPrice,
        discountAmount,
        appliedCouponCode,
        redemptionDiscountAmount,
        redemptionCodePrefix,
    } = params;

    const safeTotal = Math.max(0, Number.isFinite(totalPrice) ? totalPrice : 0);
    const discountCandidate = discountAmount === null ? redemptionDiscountAmount : discountAmount;
    const safeDiscountCandidate = Math.max(0, Number.isFinite(discountCandidate) ? discountCandidate : 0);

    const subtotalCandidate = subtotalPrice === null
        ? safeTotal + safeDiscountCandidate
        : subtotalPrice;
    const safeSubtotalCandidate = Math.max(0, Number.isFinite(subtotalCandidate) ? subtotalCandidate : 0);
    const safeSubtotal = Math.max(safeTotal, safeSubtotalCandidate);
    const safeDiscount = Math.max(0, Math.min(safeDiscountCandidate, safeSubtotal));

    let safeAppliedCouponCode = appliedCouponCode;
    if (!safeAppliedCouponCode && safeDiscount > 0 && redemptionCodePrefix) {
        safeAppliedCouponCode = `${String(redemptionCodePrefix).toUpperCase()}******`;
    }

    return {
        subtotalPrice: safeSubtotal,
        discountAmount: safeDiscount,
        appliedCouponCode: safeAppliedCouponCode,
    };
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

        const signaturePaymentId = getMercadoPagoWebhookSignatureDataId(request.url);
        if (!signaturePaymentId || signaturePaymentId !== paymentId.toLowerCase()) {
            opsLog('warn', 'MP_WEBHOOK_INVALID', {
                reason: signaturePaymentId ? 'PAYMENT_ID_MISMATCH' : 'MISSING_SIGNED_PAYMENT_ID',
                paymentId,
            });
            return NextResponse.json({ error: 'Identificador assinado inválido' }, { status: 400 });
        }

        const signature = request.headers.get('x-signature');
        const requestId = request.headers.get('x-request-id');
        if (process.env.NODE_ENV === 'production' && !process.env.MP_WEBHOOK_SECRET) {
            opsLog('error', 'MP_WEBHOOK_CONFIG_ERROR', { reason: 'MISSING_MP_WEBHOOK_SECRET', paymentId });
            return NextResponse.json({ error: 'Webhook não configurado' }, { status: 500 });
        }
        const sigResult = validateMercadoPagoWebhookSignature({
            signature,
            requestId,
            webhookSecret: process.env.MP_WEBHOOK_SECRET,
            paymentId: signaturePaymentId,
        });
        if (!sigResult.ok) {
            opsLog('warn', 'MP_WEBHOOK_INVALID', { reason: 'INVALID_SIGNATURE', paymentId });
            Sentry.captureMessage('Mercado Pago webhook signature validation failed', { level: 'warning' });
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
            Sentry.captureMessage('Mercado Pago payment lookup failed', { level: 'error' });
            return NextResponse.json(
                { error: 'Falha ao buscar pagamento', status: paymentResponse.status },
                { status: 502 }
            );
        }

        const paymentData = await paymentResponse.json();
        const mpStatus = paymentData?.status as string | undefined;
        const paymentStatusDetail = String(paymentData?.status_detail || '').trim().toLowerCase();
        const paymentInstallments = normalizeInstallments(paymentData?.installments);
        const paymentCardBrand = normalizeCardBrand({
            paymentMethodId: paymentData?.payment_method_id,
            paymentTypeId: paymentData?.payment_type_id,
        });
        const paymentMethod = normalizePaymentMethod({
            paymentMethodId: paymentData?.payment_method_id,
            paymentTypeId: paymentData?.payment_type_id,
            installments: paymentInstallments,
        });
        const bookingId = paymentData?.external_reference as string | undefined;
        ctxBookingId = bookingId;

        if (!bookingId) {
            opsLog('warn', 'MP_WEBHOOK_INVALID', { reason: 'MISSING_BOOKING_REFERENCE', paymentId });
            return NextResponse.json({ error: 'Referência de reserva ausente' }, { status: 400 });
        }

        const mapped = mapMercadoPagoPaymentStatus(mpStatus);
        const normalizedMpStatus = String(mpStatus || '').toLowerCase();
        const previousAttemptStatus = await getPreviousAttemptStatus(paymentId);
        const isRedeliveryOfSameStatus = previousAttemptStatus === normalizedMpStatus.toUpperCase();

        const result = await prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findUnique({
                where: { id: bookingId },
                include: {
                    payment: true,
                    guest: true,
                    roomType: true,
                    couponRedemption: {
                        include: {
                            coupon: {
                                select: { codePrefix: true },
                            },
                        },
                    },
                },
            });
            if (!booking) return { kind: 'not_found' as const };

            // Once a payment is approved for this booking, it is the primary payment. Events
            // from any other MP payment (duplicates, old preferences) must never change the
            // booking or overwrite the primary payment id.
            const primaryPaymentId = booking.payment?.status === 'APPROVED'
                ? booking.payment.providerId
                : null;
            if (primaryPaymentId && primaryPaymentId !== paymentId) {
                return {
                    kind: 'secondary_payment' as const,
                    booking,
                    primaryPaymentId,
                    bookingStatus: booking.status,
                    paymentStatus: booking.payment!.status,
                };
            }
            const samePaymentAlreadyApproved =
                booking.payment?.status === 'APPROVED' && booking.payment.providerId === paymentId;

            const paymentValidation = validateApprovedPaymentAmount({
                status: mpStatus,
                transactionAmount: paymentData?.transaction_amount,
                currencyId: paymentData?.currency_id,
                expectedAmount: booking.payment?.amount ?? booking.totalPrice,
            });
            if (!paymentValidation.ok) {
                await tx.booking.updateMany({
                    where: { id: bookingId, status: 'PENDING' },
                    data: {
                        funnelStage: 'PAYMENT_VALIDATION_FAILED',
                        funnelUpdatedAt: new Date(),
                        lastErrorMessage: paymentValidation.reason,
                    },
                });
                return {
                    kind: 'invalid_payment' as const,
                    booking,
                    reason: paymentValidation.reason,
                    expectedAmount: Number(booking.payment?.amount ?? booking.totalPrice),
                };
            }

            const currentBookingStatus = booking.status;
            const currentPaymentStatus = booking.payment?.status;

            let bookingStatus = currentBookingStatus;
            let paymentStatus = currentPaymentStatus || 'PENDING';
            let emailQueued = false;
            let couponReleased = false;
            let couponConfirmed = false;
            let financialSnapshotUpdated = false;
            const paymentMethodValue = paymentMethod || booking.payment?.method || null;
            let paymentInstallmentsValue = paymentInstallments ?? booking.payment?.installments ?? null;
            const paymentModeValue = booking.payment?.paymentMode || 'FULL';
            const paidAmountValue = Number(booking.payment?.amount ?? paymentData?.transaction_amount ?? booking.totalPrice);
            const remainingAmountValue = Number(booking.payment?.remainingAmount ?? 0);
            const balanceDueAtValue = booking.payment?.balanceDueAt ?? null;
            const balanceDueDateValue = booking.payment?.balanceDueDate ?? null;
            let purchaseEventQueued = false;
            let bookingConfirmedNow = false;

            // Depois do bloqueio do quarto (prazo do link + folga) o quarto já não estava reservado
            // para este hóspede. Só confirma se ainda houver quarto livre; senão NÃO confirma
            // (evita overbooking): a reserva expira e a equipe é avisada para realocar ou estornar.
            // Se o pagamento estava em análise, o quarto ficou bloqueado e a checagem não é necessária.
            let paidWithoutRoom = false;
            if (
                mapped.bookingStatus === 'CONFIRMED'
                && currentBookingStatus === 'PENDING'
                && getRoomHoldEnd(booking).getTime() < Date.now()
                && !PAYMENT_UNDER_REVIEW_STATUSES.includes(String(previousAttemptStatus || ''))
                && !(await hasRoomForBooking(booking, tx))
            ) {
                const update = await tx.booking.updateMany({
                    where: { id: bookingId, status: 'PENDING' },
                    data: {
                        status: 'EXPIRED',
                        funnelStage: 'PAID_WITHOUT_AVAILABILITY',
                        funnelUpdatedAt: new Date(),
                        lastErrorMessage: 'paid_after_deadline_no_availability',
                    },
                });
                if (update.count === 1) {
                    paidWithoutRoom = true;
                    bookingStatus = 'EXPIRED';
                    const release = await tx.couponRedemption.updateMany({
                        where: { bookingId, status: 'RESERVED' },
                        data: { status: 'RELEASED', releasedAt: new Date() },
                    });
                    couponReleased = release.count > 0;
                }
            }

            if (mapped.bookingStatus === 'CONFIRMED' && !paidWithoutRoom) {
                if (currentBookingStatus === 'PENDING') {
                    const update = await tx.booking.updateMany({
                        where: { id: bookingId, status: 'PENDING' },
                        data: {
                            status: 'CONFIRMED',
                            funnelStage: 'BOOKING_CONFIRMED',
                            funnelUpdatedAt: new Date(),
                            lastErrorMessage: null,
                        },
                    });
                    if (update.count === 1) {
                        bookingStatus = 'CONFIRMED';
                        emailQueued = true;
                        bookingConfirmedNow = true;
                    }
                }
                if (currentBookingStatus === 'CONFIRMED') {
                    bookingStatus = 'CONFIRMED';
                }
            }

            if (mapped.bookingStatus === 'CANCELLED') {
                // A cancelled MP payment (e.g. an expired Pix) does not cancel a pending booking:
                // the guest may still pay through another attempt, and stale pending bookings
                // are expired by expireStalePendingBookings.
                if (currentBookingStatus === 'PENDING' && normalizedMpStatus !== 'cancelled') {
                    const update = await tx.booking.updateMany({
                        where: { id: bookingId, status: 'PENDING' },
                        data: {
                            status: 'CANCELLED',
                            funnelStage: 'PAYMENT_REJECTED',
                            funnelUpdatedAt: new Date(),
                            lastErrorMessage: normalizedMpStatus || 'cancelled',
                        },
                    });
                    if (update.count === 1) {
                        bookingStatus = 'CANCELLED';
                        const release = await tx.couponRedemption.updateMany({
                            where: {
                                bookingId,
                                status: { in: ['RESERVED', 'CONFIRMED'] },
                            },
                            data: {
                                status: 'RELEASED',
                                releasedAt: new Date(),
                            },
                        });
                        couponReleased = release.count > 0;
                    }
                }
                if (mapped.paymentStatus === 'REFUNDED' && currentBookingStatus === 'CONFIRMED') {
                    const update = await tx.booking.updateMany({
                        where: { id: bookingId, status: 'CONFIRMED' },
                        data: {
                            status: 'CANCELLED',
                            funnelStage: 'BOOKING_CANCELLED',
                            funnelUpdatedAt: new Date(),
                            lastErrorMessage: normalizedMpStatus || 'refunded',
                        },
                    });
                    if (update.count === 1) {
                        bookingStatus = 'CANCELLED';
                        const release = await tx.couponRedemption.updateMany({
                            where: {
                                bookingId,
                                status: { in: ['RESERVED', 'CONFIRMED'] },
                            },
                            data: {
                                status: 'RELEASED',
                                releasedAt: new Date(),
                            },
                        });
                        couponReleased = release.count > 0;
                    }
                }
                if (currentBookingStatus === 'CANCELLED') {
                    bookingStatus = 'CANCELLED';
                }
                if (currentBookingStatus === 'CONFIRMED' && mapped.paymentStatus !== 'REFUNDED') {
                    bookingStatus = 'CONFIRMED';
                }
            }

            if (booking.payment) {
                if (mapped.paymentStatus === 'APPROVED' && currentPaymentStatus !== 'APPROVED') {
                    emailQueued = true;
                    purchaseEventQueued = true;
                }

                if (mapped.paymentStatus === 'APPROVED') {
                    if (booking.payment.status !== 'APPROVED') {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id, status: { not: 'APPROVED' } },
                            data: {
                                status: 'APPROVED',
                                providerId: paymentId,
                                method: paymentMethod || booking.payment?.method || undefined,
                                cardBrand: paymentCardBrand ?? booking.payment?.cardBrand ?? undefined,
                                installments: paymentInstallments ?? booking.payment?.installments ?? undefined,
                            },
                        });
                    } else if (!booking.payment.providerId) {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id, providerId: null },
                            data: {
                                providerId: paymentId,
                                method: paymentMethod || booking.payment?.method || undefined,
                                cardBrand: paymentCardBrand ?? booking.payment?.cardBrand ?? undefined,
                                installments: paymentInstallments ?? booking.payment?.installments ?? undefined,
                            },
                        });
                    }
                    paymentInstallmentsValue = paymentInstallments ?? booking.payment?.installments ?? null;
                    paymentStatus = 'APPROVED';
                    await tx.booking.updateMany({
                        where: { id: bookingId },
                        data: {
                            funnelStage: 'BOOKING_CONFIRMED',
                            funnelUpdatedAt: new Date(),
                            lastErrorMessage: null,
                        },
                    });
                } else if (mapped.paymentStatus === 'REJECTED') {
                    if (booking.payment.status !== 'APPROVED' && booking.payment.status !== 'REJECTED') {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id, status: { notIn: ['APPROVED', 'REJECTED'] } },
                            data: {
                                status: 'REJECTED',
                                providerId: paymentId,
                                method: paymentMethod || booking.payment?.method || undefined,
                                cardBrand: paymentCardBrand ?? booking.payment?.cardBrand ?? undefined,
                                installments: paymentInstallments ?? booking.payment?.installments ?? undefined,
                            },
                        });
                        paymentStatus = 'REJECTED';
                    } else {
                        paymentStatus = booking.payment.status;
                    }
                    paymentInstallmentsValue = paymentInstallments ?? booking.payment?.installments ?? null;
                    await tx.booking.updateMany({
                        where: { id: bookingId },
                        data: {
                            funnelStage: 'PAYMENT_REJECTED',
                            funnelUpdatedAt: new Date(),
                            lastErrorMessage: paymentStatusDetail || normalizedMpStatus || 'rejected',
                        },
                    });
                } else if (mapped.paymentStatus === 'REFUNDED') {
                    if (booking.payment.status !== 'REFUNDED') {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id, status: { not: 'REFUNDED' } },
                            data: {
                                status: 'REFUNDED',
                                providerId: paymentId,
                                method: paymentMethod || booking.payment?.method || undefined,
                                cardBrand: paymentCardBrand ?? booking.payment?.cardBrand ?? undefined,
                                installments: paymentInstallments ?? booking.payment?.installments ?? undefined,
                            },
                        });
                    }
                    paymentInstallmentsValue = paymentInstallments ?? booking.payment?.installments ?? null;
                    paymentStatus = 'REFUNDED';
                    await tx.booking.updateMany({
                        where: { id: bookingId },
                        data: {
                            funnelStage: 'BOOKING_CANCELLED',
                            funnelUpdatedAt: new Date(),
                            lastErrorMessage: normalizedMpStatus || 'refunded',
                        },
                    });
                } else {
                    if (booking.payment.providerId !== paymentId) {
                        await tx.payment.updateMany({
                            where: { id: booking.payment.id },
                            data: {
                                providerId: paymentId,
                                method: paymentMethod || booking.payment?.method || undefined,
                                cardBrand: paymentCardBrand ?? booking.payment?.cardBrand ?? undefined,
                                installments: paymentInstallments ?? booking.payment?.installments ?? undefined,
                            },
                        });
                    }
                    paymentInstallmentsValue = paymentInstallments ?? booking.payment?.installments ?? null;
                    paymentStatus = booking.payment.status;
                    await tx.booking.updateMany({
                        where: { id: bookingId },
                        data: {
                            funnelStage: 'PAYMENT_PENDING',
                            funnelUpdatedAt: new Date(),
                            lastErrorMessage: null,
                        },
                    });
                }
            } else {
                const initialStatus = mapped.paymentStatus;
                await tx.payment.create({
                    data: {
                        bookingId,
                        amount: booking.totalPrice,
                        totalAmount: booking.totalPrice,
                        remainingAmount: 0,
                        paymentMode: 'FULL',
                        provider: 'MERCADOPAGO',
                        providerId: paymentId,
                        method: paymentMethod,
                        cardBrand: paymentCardBrand,
                        installments: paymentInstallments,
                        status: initialStatus,
                    },
                });
                paymentInstallmentsValue = paymentInstallments;
                paymentStatus = initialStatus;
                purchaseEventQueued = initialStatus === 'APPROVED';
                await tx.booking.updateMany({
                    where: { id: bookingId },
                    data: {
                        funnelStage: initialStatus === 'APPROVED'
                            ? 'BOOKING_CONFIRMED'
                            : initialStatus === 'REJECTED'
                                ? 'PAYMENT_REJECTED'
                                : 'PAYMENT_PENDING',
                        funnelUpdatedAt: new Date(),
                        lastErrorMessage: initialStatus === 'REJECTED'
                            ? (paymentStatusDetail || normalizedMpStatus || 'rejected')
                            : null,
                    },
                });
            }

            if (mapped.paymentStatus === 'APPROVED') {
                const normalized = normalizeFinancialSnapshot({
                    totalPrice: Number(booking.totalPrice),
                    subtotalPrice: booking.subtotalPrice === null ? null : Number(booking.subtotalPrice),
                    discountAmount: booking.discountAmount === null ? null : Number(booking.discountAmount),
                    appliedCouponCode: booking.appliedCouponCode,
                    redemptionDiscountAmount: Number(booking.couponRedemption?.discountAmount || 0),
                    redemptionCodePrefix: booking.couponRedemption?.coupon?.codePrefix,
                });

                const shouldUpdateSnapshot =
                    booking.subtotalPrice === null ||
                    booking.discountAmount === null ||
                    (booking.appliedCouponCode === null && normalized.appliedCouponCode !== null);

                if (shouldUpdateSnapshot) {
                    await tx.booking.updateMany({
                        where: { id: bookingId },
                        data: {
                            subtotalPrice: normalized.subtotalPrice,
                            discountAmount: normalized.discountAmount,
                            appliedCouponCode: normalized.appliedCouponCode,
                        },
                    });
                    financialSnapshotUpdated = true;
                }

                if (booking.couponRedemption?.status === 'RESERVED') {
                    const confirm = await tx.couponRedemption.updateMany({
                        where: {
                            id: booking.couponRedemption.id,
                            status: 'RESERVED',
                        },
                        data: {
                            status: 'CONFIRMED',
                            confirmedAt: new Date(),
                            bookingId,
                        },
                    });
                    couponConfirmed = confirm.count > 0;
                }
            }

            return {
                kind: 'ok' as const,
                booking,
                bookingStatus,
                paymentStatus,
                paymentMethod: paymentMethodValue,
                paymentInstallments: paymentInstallmentsValue,
                paymentMode: paymentModeValue,
                paidAmount: paidAmountValue,
                remainingAmount: remainingAmountValue,
                balanceDueAt: balanceDueAtValue,
                balanceDueDate: balanceDueDateValue,
                emailQueued,
                couponReleased,
                couponConfirmed,
                financialSnapshotUpdated,
                purchaseEventQueued,
                bookingConfirmedNow,
                samePaymentAlreadyApproved,
                paidWithoutRoom,
            };
        });

        if (result.kind === 'not_found') {
            opsLog('warn', 'MP_WEBHOOK_BOOKING_NOT_FOUND', {
                bookingId,
                bookingIdShort: bookingId.slice(0, 8),
                paymentId,
            });
            Sentry.captureMessage('Mercado Pago payment references an unknown booking', { level: 'error' });
            return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
        }
        await recordPaymentAttempt({
            bookingId,
            paymentId,
            paymentData,
            method: paymentMethod,
            cardBrand: paymentCardBrand,
            installments: paymentInstallments,
        });
        if (result.kind === 'invalid_payment') {
            opsLog('error', 'MP_WEBHOOK_PAYMENT_VALIDATION_FAILED', {
                bookingId,
                bookingIdShort: bookingId.slice(0, 8),
                paymentId,
                reason: result.reason,
                expectedAmount: result.expectedAmount,
                transactionAmount: paymentData?.transaction_amount,
                currencyId: paymentData?.currency_id,
            });
            Sentry.captureMessage('Mercado Pago approved payment failed amount validation', { level: 'error' });
            const { sendDifficultyAlertEmail } = await import('@/lib/email');
            await sendDifficultyAlertEmail({
                guestName: result.booking.guest.name,
                guestEmail: result.booking.guest.email,
                guestPhone: result.booking.guest.phone,
                bookingId: result.booking.id,
                roomName: result.booking.roomType.name,
                totalPrice: Number(result.booking.totalPrice),
                step: 'Validação do pagamento aprovado',
                reason: `Divergência entre o pagamento recebido e o valor esperado (${result.reason}).`,
                paymentProviderId: paymentId,
            });
            return NextResponse.json({ ok: true, status: 'ignored', reason: result.reason });
        }

        if (result.kind === 'secondary_payment') {
            const isDuplicateApproval = normalizedMpStatus === 'approved';
            const isDuplicateChargeback = normalizedMpStatus === 'charged_back';
            const shouldAlert = (isDuplicateApproval || isDuplicateChargeback) && !isRedeliveryOfSameStatus;

            opsLog(isDuplicateApproval ? 'error' : 'warn', isDuplicateApproval
                ? 'MP_WEBHOOK_DUPLICATE_APPROVED_PAYMENT'
                : 'MP_WEBHOOK_SECONDARY_PAYMENT_EVENT', {
                bookingIdShort: bookingId.slice(0, 8),
                paymentId,
                primaryPaymentId: result.primaryPaymentId,
                mpStatus,
                paymentStatusDetail,
                alerted: shouldAlert,
            });

            if (shouldAlert) {
                Sentry.captureMessage(isDuplicateApproval
                    ? 'Mercado Pago duplicate approved payment for a paid booking'
                    : 'Mercado Pago chargeback on a secondary payment', { level: 'error' });
                const { sendDifficultyAlertEmail } = await import('@/lib/email');
                await sendDifficultyAlertEmail({
                    guestName: result.booking.guest.name,
                    guestEmail: result.booking.guest.email,
                    guestPhone: result.booking.guest.phone,
                    bookingId: result.booking.id,
                    roomName: result.booking.roomType.name,
                    totalPrice: Number(result.booking.totalPrice),
                    step: isDuplicateApproval ? 'Pagamento duplicado' : 'Contestação em pagamento duplicado',
                    reason: isDuplicateApproval
                        ? `Um segundo pagamento aprovado (${paymentId}) chegou para uma reserva já paga pelo pagamento ${result.primaryPaymentId}. A reserva não foi alterada; avalie o estorno do pagamento duplicado.`
                        : `O pagamento ${paymentId}, que não é o pagamento principal (${result.primaryPaymentId}), recebeu uma contestação. A reserva não foi alterada.`,
                    paymentStatusDetail,
                    paymentProviderId: paymentId,
                });
            }

            return NextResponse.json({
                ok: true,
                status: isDuplicateApproval ? 'duplicate_payment' : 'secondary_payment_ignored',
                bookingId,
                mpStatus,
                primaryPaymentId: result.primaryPaymentId,
                bookingStatus: result.bookingStatus,
                paymentStatus: result.paymentStatus,
            });
        }

        if (
            normalizedMpStatus === 'approved'
            && !['CONFIRMED', 'PAID'].includes(result.bookingStatus)
            && !result.samePaymentAlreadyApproved
            && !isRedeliveryOfSameStatus
        ) {
            Sentry.captureMessage('Mercado Pago payment approved without booking confirmation', { level: 'error' });
            const { sendDifficultyAlertEmail } = await import('@/lib/email');
            await sendDifficultyAlertEmail({
                guestName: result.booking.guest.name,
                guestEmail: result.booking.guest.email,
                guestPhone: result.booking.guest.phone,
                bookingId: result.booking.id,
                roomName: result.booking.roomType.name,
                totalPrice: Number(result.booking.totalPrice),
                step: result.paidWithoutRoom
                    ? 'Pagamento recebido sem quarto disponível'
                    : 'Pagamento aprovado sem confirmação da reserva',
                reason: result.paidWithoutRoom
                    ? 'O pagamento chegou depois do prazo da reserva e o quarto já não está disponível. A reserva NÃO foi confirmada: fale com o hóspede para realocar ou estornar.'
                    : `O Mercado Pago aprovou o pagamento, mas a reserva permaneceu com status ${result.bookingStatus}.`,
                paymentProviderId: paymentId,
            });
        }

        if (normalizedMpStatus === 'rejected') {
            try {
                const recentRejections = await prisma.paymentAttempt.count({
                    where: { bookingId, status: 'REJECTED', createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
                });
                if (recentRejections === 3) {
                    Sentry.captureMessage('Repeated Mercado Pago payment rejections', { level: 'warning' });
                    const { sendDifficultyAlertEmail } = await import('@/lib/email');
                    await sendDifficultyAlertEmail({
                        guestName: result.booking.guest.name,
                        guestEmail: result.booking.guest.email,
                        guestPhone: result.booking.guest.phone,
                        bookingId: result.booking.id,
                        roomName: result.booking.roomType.name,
                        totalPrice: Number(result.booking.totalPrice),
                        step: 'Sequência de recusas no pagamento',
                        reason: 'Três pagamentos foram recusados para esta reserva na última hora.',
                        paymentStatusDetail,
                        paymentProviderId: paymentId,
                    });
                }
            } catch (alertError) {
                opsLog('warn', 'MP_REJECTION_SEQUENCE_ALERT_FAILED', {
                    bookingId, message: alertError instanceof Error ? alertError.message : String(alertError),
                });
            }
        }
        let emailSent = false;
        let emailErrorMessage: string | undefined;
        let adminAlertSent = false;
        let adminAlertErrorMessage: string | undefined;
        let gaPurchaseSent = false;
        let gaPurchaseSkipped: string | undefined;
        let gaPurchaseError: string | undefined;
        const { sendBookingConfirmationEmail, sendBookingCreatedAlertEmail } = await import('@/lib/email');

        // Pagamento aprovado para reserva expirada/cancelada não confirma a estadia: o hóspede
        // não recebe "reserva confirmada"; a equipe recebe o alerta acima e decide (reativar ou estornar).
        const bookingIsConfirmed = ['CONFIRMED', 'PAID'].includes(result.bookingStatus);
        if (result.emailQueued && mpStatus === 'approved' && bookingIsConfirmed) {
            const emailResult = await sendBookingConfirmationEmail({
                guestName: result.booking.guest.name,
                guestEmail: result.booking.guest.email,
                guestPhone: result.booking.guest.phone || null,
                bookingId: result.booking.id,
                roomName: result.booking.roomType.name,
                checkIn: result.booking.checkIn,
                checkOut: result.booking.checkOut,
                totalPrice: Number(result.booking.totalPrice),
                paymentMethod: result.paymentMethod,
                paymentInstallments: result.paymentInstallments,
                paymentMode: result.paymentMode,
                paidAmount: result.paidAmount,
                remainingAmount: result.remainingAmount,
                balanceDueAt: result.balanceDueAt,
                balanceDueDate: result.balanceDueDate,
                adults: result.booking.adults,
                children: result.booking.children,
                childrenAges: result.booking.childrenAges,
                pets: result.booking.pets,
                bookingStatus: result.bookingStatus,
                paymentStatus: result.paymentStatus,
                bookingCreatedAt: result.booking.createdAt,
            });

            emailSent = Boolean(emailResult?.success);
            if (emailSent) {
                await prisma.booking.updateMany({
                    where: { id: bookingId, confirmationEmailSentAt: null },
                    data: { confirmationEmailSentAt: new Date() },
                });
            } else {
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

        const shouldSendAdminAlert =
            (normalizedMpStatus === 'approved' && result.emailQueued) ||
            (['rejected', 'refunded', 'cancelled', 'charged_back'].includes(normalizedMpStatus)
                && !isRedeliveryOfSameStatus);

        if (shouldSendAdminAlert) {
            const adminAlertResult = await sendBookingCreatedAlertEmail({
                guestName: result.booking.guest.name,
                guestEmail: result.booking.guest.email,
                guestPhone: result.booking.guest.phone || null,
                bookingId: result.booking.id,
                roomName: result.booking.roomType.name,
                checkIn: result.booking.checkIn,
                checkOut: result.booking.checkOut,
                totalPrice: Number(result.booking.totalPrice),
                paymentMethod: result.paymentMethod,
                paymentInstallments: result.paymentInstallments,
                paymentMode: result.paymentMode,
                paidAmount: result.paidAmount,
                remainingAmount: result.remainingAmount,
                balanceDueAt: result.balanceDueAt,
                balanceDueDate: result.balanceDueDate,
                adults: result.booking.adults,
                children: result.booking.children,
                childrenAges: result.booking.childrenAges,
                bookingStatus: result.bookingStatus,
                paymentStatus: result.paymentStatus,
                bookingCreatedAt: result.booking.createdAt,
            });

            adminAlertSent = Boolean(adminAlertResult?.success);
            if (!adminAlertSent) {
                adminAlertErrorMessage =
                    adminAlertResult?.error instanceof Error
                        ? adminAlertResult.error.message
                        : typeof adminAlertResult?.error === 'string'
                            ? adminAlertResult.error
                            : 'admin_alert_send_failed';
            }
        }

        if (result.purchaseEventQueued && result.paymentStatus === 'APPROVED') {
            const gaResult = await sendGa4PurchaseServerEvent({
                transactionId: result.booking.id,
                value: Number(result.booking.totalPrice),
                currency: 'BRL',
                itemId: result.booking.roomType?.id || result.booking.roomTypeId,
                itemName: result.booking.roomType?.name || 'Hospedagem',
                userId: result.booking.guest?.id || result.booking.guestId,
                source: 'mp_webhook',
            });

            gaPurchaseSent = gaResult.ok;
            gaPurchaseSkipped = gaResult.skipped;
            gaPurchaseError = gaResult.error;
        }

        opsLog('info', 'MP_WEBHOOK_PROCESSED', {
            bookingId,
            bookingIdShort: bookingId.slice(0, 8),
            paymentId,
            mpStatus,
            paymentStatusDetail,
            bookingStatus: result.bookingStatus,
            paymentStatus: result.paymentStatus,
            emailQueued: result.emailQueued,
            emailSent,
            emailErrorMessage,
            couponReleased: result.couponReleased,
            couponConfirmed: result.couponConfirmed,
            financialSnapshotUpdated: result.financialSnapshotUpdated,
            adminAlertSent,
            adminAlertErrorMessage,
            purchaseEventQueued: result.purchaseEventQueued,
            gaPurchaseSent,
            gaPurchaseSkipped,
            gaPurchaseError,
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
            couponReleased: result.couponReleased,
            couponConfirmed: result.couponConfirmed,
            financialSnapshotUpdated: result.financialSnapshotUpdated,
            adminAlertSent,
            adminAlertErrorMessage,
            purchaseEventQueued: result.purchaseEventQueued,
            gaPurchaseSent,
            gaPurchaseSkipped,
            gaPurchaseError,
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

