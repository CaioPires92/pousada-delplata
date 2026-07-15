import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';
import { sendBookingConfirmationEmail, sendBookingCreatedAlertEmail, sendDifficultyAlertEmail } from '@/lib/email';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';
import { sendGa4PurchaseServerEvent } from '@/lib/ga4-measurement';
import {
    DEFAULT_PARTIAL_PAYMENT_SETTINGS,
    calculatePaymentPlan,
    normalizePartialPaymentSettings,
    type PaymentMode,
} from '@/lib/partial-payment';

type MercadoPagoCause = {
    code?: number | string;
    description?: string;
    data?: string;
};

const PIX_DISCOUNT_RATE = 0.05;
const PARTIAL_PAYMENT_SETTINGS_ID = 'default';

function normalizeInstallments(value: unknown) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function normalizeCardBrand(params: { paymentMethodId: string; paymentTypeId: string }) {
    const paymentMethodId = String(params.paymentMethodId || '').trim().toLowerCase();
    const paymentTypeId = String(params.paymentTypeId || '').trim().toLowerCase();

    if (!paymentMethodId) return null;
    if (paymentTypeId !== 'credit_card' && paymentTypeId !== 'debit_card') return null;
    if (paymentMethodId === 'credit_card' || paymentMethodId === 'debit_card') return null;

    return paymentMethodId.toUpperCase();
}

function normalizePaymentMethod(params: {
    paymentMethodId: string;
    paymentTypeId: string;
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
    if (!paymentMethodId) return 'UNKNOWN';
    return paymentMethodId.toUpperCase();
}

function detectPixKeyNotEnabled(error: any) {
    const status = Number(error?.status || 0);
    const causes: MercadoPagoCause[] = Array.isArray(error?.cause) ? error.cause : [];
    const has13253 = causes.some((c) => Number(c?.code) === 13253);
    const hasMessage = causes.some((c) => String(c?.description || '').toLowerCase().includes('without key enabled for qr'));

    return status === 400 && (has13253 || hasMessage);
}
function formatBrl(value: number) {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isPixPayment(params: { paymentMethodId: string; paymentTypeId: string }) {
    const paymentMethodId = String(params.paymentMethodId || '').trim().toLowerCase();
    const paymentTypeId = String(params.paymentTypeId || '').trim().toLowerCase();

    return paymentMethodId === 'pix' || paymentTypeId === 'bank_transfer';
}

function getMinTransactionAmount(isPix: boolean) {
    const envKey = isPix ? 'MP_MIN_TRANSACTION_AMOUNT_PIX' : 'MP_MIN_TRANSACTION_AMOUNT';
    const fallback = isPix ? 0.01 : 1;
    const parsed = Number.parseFloat(String(process.env[envKey] ?? fallback));
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function detectInvalidTransactionAmount(error: any) {
    const status = Number(error?.status || 0);
    const message = String(error?.message || '').toLowerCase();
    const causes: MercadoPagoCause[] = Array.isArray(error?.cause) ? error.cause : [];

    const causeMentionsAmount = causes.some((cause) => {
        const description = String(cause?.description || '').toLowerCase();
        const data = String(cause?.data || '').toLowerCase();
        return description.includes('transaction_amount') || data.includes('transaction_amount');
    });

    return status === 400 && (message.includes('transaction_amount') || causeMentionsAmount);
}

function applyPixDiscount(amount: number) {
    return Number((amount * (1 - PIX_DISCOUNT_RATE)).toFixed(2));
}

function normalizePaymentMode(value: unknown): PaymentMode {
    return String(value || '').trim().toUpperCase() === 'PARTIAL' ? 'PARTIAL' : 'FULL';
}

function serializePartialPaymentSettings(settings: any) {
    return normalizePartialPaymentSettings({
        enabled: settings?.enabled ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.enabled,
        percentage: settings?.percentage ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.percentage,
        minimumBookingAmount: settings?.minimumBookingAmount == null ? null : Number(settings.minimumBookingAmount),
        minimumLeadTimeDays: settings?.minimumLeadTimeDays ?? null,
        balanceDueAt: settings?.balanceDueAt ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.balanceDueAt,
        balanceDueDaysBeforeCheckIn: settings?.balanceDueDaysBeforeCheckIn ?? null,
        defaultPaymentMode: settings?.defaultPaymentMode ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.defaultPaymentMode,
    });
}

function detectPayerEmailForbidden(error: any) {
    const status = Number(error?.status || 0);
    const message = String(error?.message || '').toLowerCase();
    const causes: MercadoPagoCause[] = Array.isArray(error?.cause) ? error.cause : [];

    const hasForbiddenCause = causes.some((cause) => {
        const description = String(cause?.description || '').toLowerCase();
        return description.includes('payer email forbidden');
    });

    return status === 403 && (message.includes('payer email forbidden') || hasForbiddenCause);
}

function getMercadoPagoErrorMessage(error: any) {
    const causes: MercadoPagoCause[] = Array.isArray(error?.cause) ? error.cause : [];
    const firstCause = causes.find((c) => String(c?.description || '').trim().length > 0);
    if (firstCause?.description) return String(firstCause.description);

    const message = String(error?.message || '').trim();
    return message || 'Erro ao processar pagamento';
}

function isMercadoPagoTestMode(accessToken: string) {
    return accessToken.startsWith('TEST-');
}

function isLocalCardSandboxEnabled(params: {
    accessToken: string;
    pixPayment: boolean;
}) {
    return (
        process.env.NODE_ENV !== 'production'
        && String(process.env.ENABLE_TEST_PAYMENTS || '').trim().toLowerCase() === 'true'
        && isMercadoPagoTestMode(params.accessToken)
        && !params.pixPayment
    );
}

function isMercadoPagoTestUserEmail(email: unknown) {
    return String(email || '').trim().toLowerCase().endsWith('@testuser.com');
}

function resolveMercadoPagoPayerEmail(params: {
    accessToken: string;
    payerEmail: string;
}) {
    const normalizedPayerEmail = String(params.payerEmail || '').trim();
    const overrideEmail = String(process.env.MP_TEST_PAYER_EMAIL || '').trim();

    if (normalizedPayerEmail) {
        return normalizedPayerEmail;
    }

    if (
        process.env.NODE_ENV !== 'production' &&
        isMercadoPagoTestMode(params.accessToken) &&
        overrideEmail
    ) {
        return overrideEmail;
    }

    return normalizedPayerEmail;
}

function getMercadoPagoClientFacingMessage(error: any) {
    const raw = getMercadoPagoErrorMessage(error);
    const normalized = raw.toLowerCase();
    const status = Number(error?.status || 0);

    if (status >= 500 || normalized === 'internal_error' || normalized === 'unknown error') {
        return 'Nao foi possivel processar o pagamento agora. Tente novamente em instantes ou fale com a pousada no WhatsApp.';
    }

    return raw;
}

async function updateBookingFunnelStatus(params: {
    bookingId?: string;
    stage: string;
    message?: string | null;
}) {
    if (!params.bookingId) return;

    try {
        await prisma.booking.updateMany({
            where: { id: params.bookingId },
            data: {
                funnelStage: params.stage,
                funnelUpdatedAt: new Date(),
                lastErrorMessage: params.message ?? null,
            },
        });
    } catch (error) {
        console.error('[MP Payment] Failed to update booking funnel status', error);
    }
}

async function sendPaymentDifficultyAlert(params: {
    bookingId?: string;
    step: string;
    reason: string;
    error?: string | null;
    funnelStage?: string | null;
}) {
    if (!params.bookingId) return;

    try {
        const booking = await prisma.booking.findUnique({
            where: { id: params.bookingId },
            include: {
                guest: true,
                roomType: true,
            },
        });

        if (!booking) return;

        await sendDifficultyAlertEmail({
            guestName: booking.guest.name,
            guestEmail: booking.guest.email,
            guestPhone: booking.guest.phone || null,
            bookingId: booking.id,
            roomName: booking.roomType.name,
            totalPrice: Number(booking.totalPrice),
            step: params.step,
            reason: params.reason,
            error: params.error,
            funnelStage: params.funnelStage || booking.funnelStage || null,
        });
    } catch (alertError) {
        opsLog('error', 'MP_PAYMENT_DIFFICULTY_ALERT_FAILED', {
            bookingId: params.bookingId,
            step: params.step,
            error: alertError instanceof Error ? alertError.message : String(alertError),
        });
    }
}

export async function POST(request: Request) {
    let ctxBookingId: string | undefined;
    let ctxRequestedAmount: number | undefined;
    let ctxPaymentMethodId: string | undefined;
    let ctxPaymentTypeId: string | undefined;
    let ctxInstallments: number | null | undefined;
    let ctxPayerEmail: string | undefined;

    try {
        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            return NextResponse.json({ error: 'MP_ACCESS_TOKEN ausente' }, { status: 500 });
        }

        const body = await request.json();
        const { bookingId, transaction_amount, description, skipGuestEmail, paymentMode: rawPaymentMode, ...formData } = body || {};

        ctxBookingId = typeof bookingId === 'string' ? bookingId : undefined;

        if (!bookingId || !transaction_amount) {
            return NextResponse.json({ error: 'Dados insuficientes para pagamento' }, { status: 400 });
        }

        const paymentMethodId = formData?.payment_method_id;
        const paymentTypeId = String(formData?.payment_type_id || '');
        const normalizedInstallments = normalizeInstallments(formData?.installments);
        const normalizedCardBrand = normalizeCardBrand({
            paymentMethodId: String(paymentMethodId || ''),
            paymentTypeId,
        });
        const normalizedPaymentMethod = normalizePaymentMethod({
            paymentMethodId: String(paymentMethodId || ''),
            paymentTypeId,
            installments: normalizedInstallments,
        });
        const payerEmail = formData?.payer?.email;
        ctxPaymentMethodId = typeof paymentMethodId === 'string' ? paymentMethodId : undefined;
        ctxPaymentTypeId = paymentTypeId;
        ctxInstallments = normalizedInstallments;
        const resolvedPayerEmail = resolveMercadoPagoPayerEmail({
            accessToken,
            payerEmail: typeof payerEmail === 'string' ? payerEmail : '',
        });
        ctxPayerEmail = resolvedPayerEmail || (typeof payerEmail === 'string' ? payerEmail : undefined);
        if (!paymentMethodId || typeof paymentMethodId !== 'string') {
            return NextResponse.json({ error: 'payment_method_id ausente' }, { status: 400 });
        }
        if (!resolvedPayerEmail) {
            return NextResponse.json({ error: 'payer.email ausente' }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                payment: true,
                guest: true,
                roomType: true,
            },
        });
        if (!booking) {
            opsLog('warn', 'MP_PAYMENT_INVALID_BOOKING', {
                bookingId,
                paymentMethodId,
                paymentTypeId,
                installments: normalizedInstallments,
                payerEmail: resolvedPayerEmail,
            });
            return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
        }

        await updateBookingFunnelStatus({
            bookingId,
            stage: 'PAYMENT_ATTEMPT_STARTED',
            message: null,
        });

        if (booking.payment?.status === 'APPROVED' || booking.payment?.status === 'PENDING') {
            opsLog('warn', 'MP_PAYMENT_DUPLICATE_BLOCK', {
                bookingId,
                paymentStatus: booking.payment?.status,
            });
            await updateBookingFunnelStatus({
                bookingId,
                stage: 'PAYMENT_DUPLICATE',
                message: 'payment_already_exists',
            });
            await sendPaymentDifficultyAlert({
                bookingId,
                step: 'Pagamento',
                reason: 'Pagamento duplicado',
                error: `Ja existe pagamento ${booking.payment?.status} para esta reserva.`,
                funnelStage: 'PAYMENT_DUPLICATE',
            });
            return NextResponse.json({ error: 'Pagamento já existe para esta reserva' }, { status: 409 });
        }

        const bookingAmount = Number(booking.totalPrice);
        const requestedAmount = Number(transaction_amount);
        const pixPayment = isPixPayment({
            paymentMethodId: String(paymentMethodId || ''),
            paymentTypeId,
        });
        const settingsRow = await prisma.partialPaymentSettings.findUnique({
            where: { id: PARTIAL_PAYMENT_SETTINGS_ID },
        });
        const paymentPlan = calculatePaymentPlan({
            settings: serializePartialPaymentSettings(settingsRow),
            totalAmount: bookingAmount,
            checkIn: booking.checkIn,
            paymentMode: normalizePaymentMode(rawPaymentMode),
        });

        if (!paymentPlan.ok) {
            opsLog('warn', 'MP_PAYMENT_PARTIAL_NOT_ALLOWED', {
                bookingId,
                bookingAmount,
                paymentMode: rawPaymentMode,
                reasons: paymentPlan.evaluation.reasons,
            });
            return NextResponse.json(
                {
                    error: 'partial_payment_not_allowed',
                    message: 'Esta reserva nao permite pagamento parcial. Selecione pagamento integral.',
                    reasons: paymentPlan.evaluation.reasons,
                },
                { status: 400 }
            );
        }

        const amountDueNow = paymentPlan.amountDueNow;
        const remainingAmount = paymentPlan.remainingAmount;
        const expectedAmount = pixPayment ? applyPixDiscount(amountDueNow) : amountDueNow;
        const minTransactionAmount = getMinTransactionAmount(pixPayment);

        ctxRequestedAmount = requestedAmount;
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
            await updateBookingFunnelStatus({
                bookingId,
                stage: 'PAYMENT_ERROR',
                message: 'invalid_transaction_amount',
            });
            await sendPaymentDifficultyAlert({
                bookingId,
                step: 'Pagamento',
                reason: 'Valor invalido',
                error: 'transaction_amount invalido',
                funnelStage: 'PAYMENT_ERROR',
            });
            return NextResponse.json({ error: 'transaction_amount inválido' }, { status: 400 });
        }

        if (expectedAmount < minTransactionAmount || requestedAmount < minTransactionAmount) {
            const minimumMessage = pixPayment
                ? `Valor minimo para pagamento via Pix e R$ ${formatBrl(minTransactionAmount)}.`
                : `Este valor nao permite pagamento com cartao. Escolha Pix ou aumente o valor da reserva (minimo R$ ${formatBrl(minTransactionAmount)}).`;

            opsLog('warn', 'MP_PAYMENT_AMOUNT_BELOW_MINIMUM', {
                bookingId,
                bookingAmount,
                amountDueNow,
                remainingAmount,
                expectedAmount,
                requestedAmount,
                minTransactionAmount,
                paymentMethodId,
                paymentTypeId,
                pixPayment,
            });
            await updateBookingFunnelStatus({
                bookingId,
                stage: 'PAYMENT_ERROR',
                message: 'transaction_amount_below_minimum',
            });
            await sendPaymentDifficultyAlert({
                bookingId,
                step: 'Pagamento',
                reason: 'Valor abaixo do minimo permitido',
                error: minimumMessage,
                funnelStage: 'PAYMENT_ERROR',
            });
            return NextResponse.json(
                {
                    error: 'transaction_amount inválido',
                    message: minimumMessage,
                },
                { status: 400 }
            );
        }

        if (Math.abs(expectedAmount - requestedAmount) > 0.01) {
            opsLog('warn', 'MP_PAYMENT_AMOUNT_MISMATCH', {
                bookingId,
                bookingAmount,
                amountDueNow,
                remainingAmount,
                expectedAmount,
                requestedAmount,
                paymentMode: paymentPlan.paymentMode,
                paymentMethodId,
                paymentTypeId,
                installments: normalizedInstallments,
                payerEmail: resolvedPayerEmail,
            });
            await updateBookingFunnelStatus({
                bookingId,
                stage: 'PAYMENT_ERROR',
                message: 'amount_mismatch',
            });
            await sendPaymentDifficultyAlert({
                bookingId,
                step: 'Pagamento',
                reason: 'Valor divergente',
                error: `Esperado R$ ${formatBrl(expectedAmount)}, recebido R$ ${formatBrl(requestedAmount)}.`,
                funnelStage: 'PAYMENT_ERROR',
            });
            return NextResponse.json({ error: 'Valor divergente da reserva' }, { status: 400 });
        }

        const localCardSandbox = isLocalCardSandboxEnabled({
            accessToken,
            pixPayment,
        });
        const result: any = localCardSandbox
            ? {
                  id: `LOCAL_SANDBOX_${bookingId}_${Date.now()}`,
                  status: 'approved',
                  status_detail: 'accredited',
                  payment_method_id: paymentMethodId,
                  payment_type_id: paymentTypeId || 'credit_card',
                  transaction_amount: requestedAmount,
                  external_reference: bookingId,
                  live_mode: false,
                  sandbox: true,
              }
            : await new Payment(new MercadoPagoConfig({ accessToken })).create({
                  body: {
                      ...formData,
                      payer: {
                          ...(formData?.payer || {}),
                          email: resolvedPayerEmail,
                      },
                      transaction_amount: requestedAmount,
                      description: description || `Reserva ${bookingId}`,
                      external_reference: bookingId,
                  },
              });

        if (localCardSandbox) {
            opsLog('info', 'LOCAL_CARD_SANDBOX_APPROVED', {
                bookingId,
                requestedAmount,
                paymentMethodId,
                paymentTypeId,
                installments: normalizedInstallments,
            });
        }

        const normalizedStatus = String(result.status || 'PENDING').toUpperCase();

        try {
            await prisma.payment.upsert({
                where: { bookingId },
                update: {
                    amount: requestedAmount,
                    totalAmount: bookingAmount,
                    remainingAmount,
                    paymentMode: paymentPlan.paymentMode,
                    balanceDueAt: paymentPlan.balanceDueAt,
                    balanceDueDate: paymentPlan.balanceDueDate,
                    status: normalizedStatus,
                    provider: localCardSandbox ? 'MERCADOPAGO_SANDBOX' : 'MERCADOPAGO',
                    providerId: String(result.id || ''),
                    method: normalizedPaymentMethod,
                    cardBrand: normalizedCardBrand,
                    installments: normalizedInstallments,
                },
                create: {
                    bookingId,
                    amount: requestedAmount,
                    totalAmount: bookingAmount,
                    remainingAmount,
                    paymentMode: paymentPlan.paymentMode,
                    balanceDueAt: paymentPlan.balanceDueAt,
                    balanceDueDate: paymentPlan.balanceDueDate,
                    status: normalizedStatus,
                    provider: localCardSandbox ? 'MERCADOPAGO_SANDBOX' : 'MERCADOPAGO',
                    providerId: String(result.id || ''),
                    method: normalizedPaymentMethod,
                    cardBrand: normalizedCardBrand,
                    installments: normalizedInstallments,
                },
            });
        } catch (e) {
            console.error('Aviso: erro ao registrar pagamento', e);
        }

        await updateBookingFunnelStatus({
            bookingId,
            stage: normalizedStatus === 'APPROVED'
                ? 'PAYMENT_APPROVED'
                : ['REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK'].includes(normalizedStatus)
                    ? 'PAYMENT_REJECTED'
                    : 'PAYMENT_PENDING',
            message: ['REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK'].includes(normalizedStatus)
                ? normalizedStatus.toLowerCase()
                : null,
        });

        if (normalizedStatus === 'APPROVED') {
            await prisma.booking.updateMany({
                where: { id: bookingId, status: 'PENDING' },
                data: {
                    status: 'CONFIRMED',
                    funnelStage: 'BOOKING_CONFIRMED',
                    funnelUpdatedAt: new Date(),
                    lastErrorMessage: null,
                },
            });

            if (!skipGuestEmail && !localCardSandbox) {
                try {
                    const confirmationEmailResult = await sendBookingConfirmationEmail({
                        guestName: booking.guest.name,
                        guestEmail: booking.guest.email,
                        guestPhone: booking.guest.phone || null,
                        bookingId: booking.id,
                        roomName: booking.roomType.name,
                        checkIn: booking.checkIn,
                        checkOut: booking.checkOut,
                        totalPrice: Number(booking.totalPrice),
                        paymentMethod: normalizedPaymentMethod,
                        paymentInstallments: normalizedInstallments,
                        paymentMode: paymentPlan.paymentMode,
                        paidAmount: requestedAmount,
                        remainingAmount,
                        balanceDueAt: paymentPlan.balanceDueAt,
                        balanceDueDate: paymentPlan.balanceDueDate,
                        adults: booking.adults,
                        children: booking.children,
                        childrenAges: booking.childrenAges,
                        bookingStatus: 'CONFIRMED',
                        paymentStatus: 'APPROVED',
                        bookingCreatedAt: booking.createdAt,
                    });

                    if (!confirmationEmailResult?.success) {
                        throw new Error(
                            confirmationEmailResult?.error instanceof Error
                                ? confirmationEmailResult.error.message
                                : String(confirmationEmailResult?.error || 'confirmation_email_failed')
                        );
                    }

                    await prisma.booking.updateMany({
                        where: { id: bookingId, confirmationEmailSentAt: null },
                        data: { confirmationEmailSentAt: new Date() },
                    });

                    await sendBookingCreatedAlertEmail({
                        guestName: booking.guest.name,
                        guestEmail: booking.guest.email,
                        guestPhone: booking.guest.phone || null,
                        bookingId: booking.id,
                        roomName: booking.roomType.name,
                        checkIn: booking.checkIn,
                        checkOut: booking.checkOut,
                        totalPrice: Number(booking.totalPrice),
                        paymentMethod: normalizedPaymentMethod,
                        paymentInstallments: normalizedInstallments,
                        paymentMode: paymentPlan.paymentMode,
                        paidAmount: requestedAmount,
                        remainingAmount,
                        balanceDueAt: paymentPlan.balanceDueAt,
                        balanceDueDate: paymentPlan.balanceDueDate,
                        adults: booking.adults,
                        children: booking.children,
                        childrenAges: booking.childrenAges,
                        bookingStatus: 'CONFIRMED',
                        paymentStatus: 'APPROVED',
                        bookingCreatedAt: booking.createdAt,
                    });
                } catch (emailError) {
                    opsLog('error', 'MP_PAYMENT_APPROVED_EMAIL_FAILED', {
                        bookingId,
                        paymentMethod: normalizedPaymentMethod,
                        error: emailError instanceof Error ? emailError.message : String(emailError),
                    });
                }
            } else if (!localCardSandbox) {
                try {
                    await sendBookingCreatedAlertEmail({
                        guestName: booking.guest.name,
                        guestEmail: booking.guest.email,
                        guestPhone: booking.guest.phone || null,
                        bookingId: booking.id,
                        roomName: booking.roomType.name,
                        checkIn: booking.checkIn,
                        checkOut: booking.checkOut,
                        totalPrice: Number(booking.totalPrice),
                        paymentMethod: normalizedPaymentMethod,
                        paymentInstallments: normalizedInstallments,
                        paymentMode: paymentPlan.paymentMode,
                        paidAmount: requestedAmount,
                        remainingAmount,
                        balanceDueAt: paymentPlan.balanceDueAt,
                        balanceDueDate: paymentPlan.balanceDueDate,
                        adults: booking.adults,
                        children: booking.children,
                        childrenAges: booking.childrenAges,
                        bookingStatus: 'CONFIRMED',
                        paymentStatus: 'APPROVED',
                        bookingCreatedAt: booking.createdAt,
                    });
                } catch (emailError) {
                    opsLog('error', 'MP_PAYMENT_APPROVED_ALERT_EMAIL_FAILED', {
                        bookingId,
                        paymentMethod: normalizedPaymentMethod,
                        error: emailError instanceof Error ? emailError.message : String(emailError),
                    });
                }
                opsLog('info', 'MP_PAYMENT_APPROVED_EMAIL_SKIPPED', {
                    bookingId,
                    reason: 'skipGuestEmail is true'
                });
            }

            if (!localCardSandbox) {
                await sendGa4PurchaseServerEvent({
                    transactionId: booking.id,
                    value: Number(booking.totalPrice),
                    currency: 'BRL',
                    itemId: booking.roomType?.id || booking.roomTypeId,
                    itemName: booking.roomType?.name || 'Hospedagem',
                    userId: booking.guest?.id || booking.guestId,
                    source: 'mp_payment_route',
                });
            }
        } else if (['REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK'].includes(normalizedStatus)) {
            await prisma.booking.updateMany({
                where: { id: bookingId, status: 'PENDING' },
                data: {
                    status: 'CANCELLED',
                    funnelStage: 'PAYMENT_REJECTED',
                    funnelUpdatedAt: new Date(),
                    lastErrorMessage: normalizedStatus.toLowerCase(),
                },
            });
            await sendBookingStatusAlertEmail(
                {
                    ...booking,
                    payment: {
                        method: normalizedPaymentMethod,
                        installments: normalizedInstallments,
                        status: normalizedStatus,
                        paymentMode: paymentPlan.paymentMode,
                        amount: requestedAmount,
                        remainingAmount,
                        balanceDueAt: paymentPlan.balanceDueAt,
                        balanceDueDate: paymentPlan.balanceDueDate,
                    },
                },
                {
                    bookingStatus: 'CANCELLED',
                    paymentStatus: normalizedStatus,
                }
            );
            await sendPaymentDifficultyAlert({
                bookingId,
                step: 'Retorno do Mercado Pago',
                reason: 'Pagamento recusado pelo Mercado Pago',
                error: normalizedStatus.toLowerCase(),
                funnelStage: 'PAYMENT_REJECTED',
            });
        }

        const pixData = (result as any)?.point_of_interaction?.transaction_data
            ? {
                  qr_code: (result as any).point_of_interaction.transaction_data.qr_code,
                  qr_code_base64: (result as any).point_of_interaction.transaction_data.qr_code_base64,
                  ticket_url: (result as any).point_of_interaction.transaction_data.ticket_url,
              }
            : null;

        return NextResponse.json({
            ...result,
            pix: pixData,
        });
    } catch (error: any) {
        if (detectPixKeyNotEnabled(error)) {
            await updateBookingFunnelStatus({
                bookingId: ctxBookingId,
                stage: 'PAYMENT_ERROR',
                message: 'pix_not_enabled',
            });
            await sendPaymentDifficultyAlert({
                bookingId: ctxBookingId,
                step: 'Comunicacao com Mercado Pago',
                reason: 'Falha tecnica no Pix',
                error: 'pix_not_enabled',
                funnelStage: 'PAYMENT_ERROR',
            });
            opsLog('warn', 'MP_PIX_KEY_NOT_ENABLED', {
                status: error?.status,
                cause: error?.cause,
            });
            return NextResponse.json(
                {
                    error: 'PIX_NOT_ENABLED',
                    message: 'Pix indisponível nesta conta do Mercado Pago. Ative uma chave Pix na conta recebedora ou use cartão.',
                },
                { status: 400 }
            );
        }

        if (detectInvalidTransactionAmount(error)) {
            const mpMessage = getMercadoPagoErrorMessage(error);
            await updateBookingFunnelStatus({
                bookingId: ctxBookingId,
                stage: 'PAYMENT_ERROR',
                message: mpMessage,
            });
            await sendPaymentDifficultyAlert({
                bookingId: ctxBookingId,
                step: 'Comunicacao com Mercado Pago',
                reason: 'Valor recusado pelo Mercado Pago',
                error: mpMessage,
                funnelStage: 'PAYMENT_ERROR',
            });
            opsLog('warn', 'MP_PAYMENT_INVALID_TRANSACTION_AMOUNT', {
                bookingId: ctxBookingId,
                requestedAmount: ctxRequestedAmount,
                status: error?.status,
                message: error?.message,
                cause: error?.cause,
            });
            return NextResponse.json(
                {
                    error: 'INVALID_TRANSACTION_AMOUNT',
                    message: 'Nao foi possivel processar este valor no metodo escolhido. Tente Pix ou um valor maior.',
                    details: mpMessage,
                },
                { status: 400 }
            );
        }

        if (detectPayerEmailForbidden(error)) {
            await updateBookingFunnelStatus({
                bookingId: ctxBookingId,
                stage: 'PAYMENT_ERROR',
                message: 'payer_email_forbidden',
            });
            await sendPaymentDifficultyAlert({
                bookingId: ctxBookingId,
                step: 'Comunicacao com Mercado Pago',
                reason: 'Dados do pagador recusados',
                error: 'payer_email_forbidden',
                funnelStage: 'PAYMENT_ERROR',
            });
            opsLog('warn', 'MP_PAYMENT_PAYER_EMAIL_FORBIDDEN', {
                bookingId: ctxBookingId,
                requestedAmount: ctxRequestedAmount,
                paymentMethodId: ctxPaymentMethodId,
                paymentTypeId: ctxPaymentTypeId,
                installments: ctxInstallments,
                payerEmail: ctxPayerEmail,
                status: error?.status,
                message: error?.message,
                cause: error?.cause,
            });
            return NextResponse.json(
                {
                    error: 'MP_PAYER_EMAIL_FORBIDDEN',
                    message:
                        'O Mercado Pago recusou o comprador de teste configurado para este ambiente. Gere um novo test user comprador no painel do Mercado Pago ou atualize MP_TEST_PAYER_EMAIL no .env.',
                },
                { status: 400 }
            );
        }

        const clientFacingMessage = getMercadoPagoClientFacingMessage(error);
        const isLikelyTestBuyerMismatch =
            ctxPayerEmail &&
            isMercadoPagoTestMode(String(process.env.MP_ACCESS_TOKEN || '')) &&
            !isMercadoPagoTestUserEmail(ctxPayerEmail) &&
            !String(process.env.MP_TEST_PAYER_EMAIL || '').trim() &&
            ['internal_error', 'unknown error'].includes(
                getMercadoPagoErrorMessage(error).trim().toLowerCase(),
            );

        await updateBookingFunnelStatus({
            bookingId: ctxBookingId,
            stage: 'PAYMENT_ERROR',
            message: isLikelyTestBuyerMismatch
                ? 'test_mode_requires_test_user_email'
                : getMercadoPagoErrorMessage(error),
        });
        await sendPaymentDifficultyAlert({
            bookingId: ctxBookingId,
            step: 'Comunicacao com Mercado Pago',
            reason: 'Erro tecnico no pagamento',
            error: isLikelyTestBuyerMismatch
                ? 'test_mode_requires_test_user_email'
                : getMercadoPagoErrorMessage(error),
            funnelStage: 'PAYMENT_ERROR',
        });
        opsLog('error', 'MP_PAYMENT_CREATE_FAILED', {
            bookingId: ctxBookingId,
            requestedAmount: ctxRequestedAmount,
            paymentMethodId: ctxPaymentMethodId,
            paymentTypeId: ctxPaymentTypeId,
            installments: ctxInstallments,
            payerEmail: ctxPayerEmail,
            status: error?.status,
            message: error?.message,
            cause: error?.cause,
        });
        console.error('Erro Mercado Pago:', error);
        if (isLikelyTestBuyerMismatch) {
            return NextResponse.json(
                {
                    error: 'MP_TEST_USER_REQUIRED',
                    message:
                        'Ambiente local com credenciais TEST do Mercado Pago. Use um comprador de teste (@testuser.com) ou configure MP_TEST_PAYER_EMAIL no .env.',
                },
                { status: 400 }
            );
        }
        return NextResponse.json(
            {
                error: 'Erro ao processar pagamento',
                message: clientFacingMessage,
            },
            { status: 500 }
        );
    }
}

