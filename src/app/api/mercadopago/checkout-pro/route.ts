import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { isValidCpf, normalizeCpf } from '@/lib/cpf';
import { resolveCheckoutPayer } from '@/lib/mercadopago/checkout-payer';
import { hasPaymentUnderReview } from '@/lib/mercadopago/payment-under-review';
import { normalizeMercadoPagoDeviceId } from '@/lib/mercadopago/device-id';
import { buildHostedCheckoutIdempotencyKey } from '@/lib/mercadopago/preference-idempotency';
import { requiresHostedMercadoPagoCheckout } from '@/lib/mercadopago/high-value-checkout';
import {
    DEFAULT_PARTIAL_PAYMENT_SETTINGS,
    calculatePaymentPlan,
    normalizePartialPaymentSettings,
    type PaymentMode,
} from '@/lib/partial-payment';
import { opsLog } from '@/lib/ops-log';
import { signBookingAccessToken } from '@/lib/booking-access';
import { consumeRequestLimit, readJsonBody, RequestGuardError } from '@/lib/request-guard';
import { buildPreferenceExpirationFields, getBookingPaymentWindow, PAYMENT_WINDOW_MESSAGES } from '@/lib/booking-payment-window';

const PARTIAL_PAYMENT_SETTINGS_ID = 'default';

const INVALID_PAYER_DATA_MESSAGES: Record<string, string> = {
    name: 'Informe nome e sobrenome do responsável pelo pagamento, como constam no CPF.',
    email: 'Informe um e-mail válido para o responsável pelo pagamento ou deixe o campo em branco.',
    phone: 'Informe um telefone válido com DDD para o responsável pelo pagamento ou deixe o campo em branco.',
};

// Resposta sem eco dos valores recebidos: só o nome do campo inválido.
function invalidPayerDataResponse(field: string) {
    return NextResponse.json({
        error: 'INVALID_PAYER_DATA',
        field,
        message: INVALID_PAYER_DATA_MESSAGES[field] || 'Revise os dados do responsável pelo pagamento.',
    }, { status: 400 });
}

function getPublicBaseUrl(request: Request) {
    const configured = String(
        process.env.NEXT_PUBLIC_BASE_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || ''
    ).trim().replace(/\/+$/, '');
    if (configured.startsWith('https://') || configured.startsWith('http://localhost')) return configured;

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    return host ? `${protocol}://${host}` : '';
}

export async function POST(request: Request) {
    try {
        const body = await readJsonBody<any>(request, 8 * 1024);
        const bookingId = String(body?.bookingId || '').trim();
        const guestEmail = String(body?.guestEmail || '').trim().toLowerCase();
        const payerCpf = normalizeCpf(body?.payerCpf);
        const deviceId = normalizeMercadoPagoDeviceId(body?.deviceId);
        const paymentMode: PaymentMode = body?.paymentMode === 'PARTIAL' ? 'PARTIAL' : 'FULL';

        if (!bookingId || !guestEmail) {
            return NextResponse.json({ error: 'BOOKING_IDENTIFICATION_REQUIRED' }, { status: 400 });
        }
        if (process.env.ENABLE_TEST_PAYMENTS !== 'true' && !isValidCpf(payerCpf)) {
            return NextResponse.json({
                error: 'INVALID_PAYER_IDENTIFICATION',
                message: 'Informe um CPF válido para continuar com o pagamento.',
            }, { status: 400 });
        }

        const rateLimit = consumeRequestLimit({
            request, scope: 'checkout-pro', discriminator: `${bookingId}:${guestEmail}`, limit: 8, windowMs: 10 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'TOO_MANY_PAYMENT_ATTEMPTS' }, {
                status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
            });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { roomType: true, guest: true, payment: true },
        });
        if (!booking || booking.guest.email.trim().toLowerCase() !== guestEmail) {
            return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
        }
        if (booking.status !== 'PENDING' || booking.payment?.status === 'APPROVED') {
            return NextResponse.json({ error: 'BOOKING_NOT_PAYABLE', message: PAYMENT_WINDOW_MESSAGES.BOOKING_NOT_PENDING }, { status: 409 });
        }
        // O link vence junto com o prazo da reserva: nada de pagamento depois que ela expira.
        const paymentWindow = getBookingPaymentWindow(booking);
        if (!paymentWindow.open) {
            return NextResponse.json({ error: paymentWindow.reason, message: PAYMENT_WINDOW_MESSAGES[paymentWindow.reason] }, { status: 409 });
        }

        const totalAmount = Number(booking.totalPrice);
        if (!requiresHostedMercadoPagoCheckout(totalAmount)) {
            return NextResponse.json({ error: 'HOSTED_CHECKOUT_NOT_REQUIRED' }, { status: 400 });
        }

        const settingsRow = await prisma.partialPaymentSettings.findUnique({
            where: { id: PARTIAL_PAYMENT_SETTINGS_ID },
        });
        const settings = normalizePartialPaymentSettings(settingsRow
            ? {
                  enabled: settingsRow.enabled,
                  percentage: settingsRow.percentage,
                  minimumBookingAmount: settingsRow.minimumBookingAmount === null
                      ? null
                      : Number(settingsRow.minimumBookingAmount),
                  minimumLeadTimeDays: settingsRow.minimumLeadTimeDays,
                  balanceDueAt: settingsRow.balanceDueAt === 'BEFORE_CHECK_IN' ? 'BEFORE_CHECK_IN' : 'CHECK_IN',
                  balanceDueDaysBeforeCheckIn: settingsRow.balanceDueDaysBeforeCheckIn,
                  defaultPaymentMode: settingsRow.defaultPaymentMode === 'PARTIAL' ? 'PARTIAL' : 'FULL',
              }
            : DEFAULT_PARTIAL_PAYMENT_SETTINGS);
        const paymentPlan = calculatePaymentPlan({
            settings,
            totalAmount,
            checkIn: booking.checkIn,
            paymentMode,
        });
        if (!paymentPlan.ok) {
            return NextResponse.json({ error: paymentPlan.error }, { status: 400 });
        }

        const testPaymentsEnabled = process.env.ENABLE_TEST_PAYMENTS === 'true';
        // Nome, e-mail, telefone e CPF de `payer` precisam ser da mesma pessoa.
        const payerResolution = testPaymentsEnabled
            ? null
            : resolveCheckoutPayer({ payer: body?.payer, cpf: payerCpf, guest: booking.guest });
        if (payerResolution && !payerResolution.ok) {
            if (payerResolution.error === 'INVALID_PAYER_IDENTIFICATION') {
                return NextResponse.json({
                    error: 'INVALID_PAYER_IDENTIFICATION',
                    message: 'Informe um CPF válido para continuar com o pagamento.',
                }, { status: 400 });
            }
            return invalidPayerDataResponse(payerResolution.field);
        }

        // Pagamento de cartão em análise pode ainda ser aprovado: abrir outra preferência
        // permitiria uma segunda cobrança da mesma reserva.
        if (await hasPaymentUnderReview(booking.id)) {
            return NextResponse.json({
                error: 'PAYMENT_UNDER_REVIEW',
                message: 'Já existe um pagamento desta reserva em análise pelo Mercado Pago. Aguarde a conclusão antes de tentar novamente.',
            }, { status: 409 });
        }

        const accessToken = String(process.env.MP_ACCESS_TOKEN || '').trim();
        const publicBaseUrl = getPublicBaseUrl(request);
        if (!accessToken || !publicBaseUrl) {
            return NextResponse.json({ error: 'PAYMENT_CONFIGURATION_ERROR' }, { status: 500 });
        }

        const bookingAccessToken = await signBookingAccessToken(booking.id);
        const confirmationUrl = new URL(`/reservar/confirmacao/${booking.id}`, publicBaseUrl);
        if (bookingAccessToken) confirmationUrl.hash = new URLSearchParams({ access: bookingAccessToken }).toString();
        const hasPublicHttpsBaseUrl = publicBaseUrl.startsWith('https://');
        const configuredTestPayerEmail = String(process.env.MP_TEST_PAYER_EMAIL || '').trim().toLowerCase();
        const testPayerEmail = configuredTestPayerEmail.endsWith('@testuser.com')
            ? configuredTestPayerEmail
            : '';
        const stayNights = Math.max(1, Math.round(
            (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000
        ));
        const checkIn = booking.checkIn.toISOString().slice(0, 10);
        const checkOut = booking.checkOut.toISOString().slice(0, 10);
        const preference = {
            items: [{
                id: booking.roomType.id,
                title: `Pousada Delplata - ${booking.roomType.name}`.slice(0, 120),
                description: `${stayNights} diária(s), ${checkIn} a ${checkOut}; ${booking.adults} adulto(s), ${booking.children} criança(s)${booking.pets > 0 ? `, ${booking.pets} pet(s)` : ''}`.slice(0, 256),
                quantity: 1,
                unit_price: paymentPlan.amountDueNow,
                currency_id: 'BRL',
                // Id do catálogo oficial GET /item_categories: "travels" = "Plane tickets, Hotel vouchers, Travel vouchers".
                category_id: 'travels',
                event_date: booking.checkIn.toISOString(),
            }],
            ...(payerResolution?.ok
                ? { payer: payerResolution.payer }
                : testPayerEmail
                    ? { payer: { email: testPayerEmail } }
                    : {}),
            ...(hasPublicHttpsBaseUrl
                ? {
                      back_urls: {
                          success: confirmationUrl.toString(),
                          failure: confirmationUrl.toString(),
                          pending: confirmationUrl.toString(),
                      },
                      auto_return: 'approved',
                  }
                : {}),
            external_reference: booking.id,
            ...(hasPublicHttpsBaseUrl
                ? { notification_url: `${publicBaseUrl}/api/webhooks/mercadopago` }
                : {}),
            statement_descriptor: 'POUSADA DELPLATA',
            ...buildPreferenceExpirationFields(paymentWindow.deadline),
            payment_methods: {
                excluded_payment_types: [{ id: 'ticket' }],
                installments: 12,
            },
        };

        const idempotency = buildHostedCheckoutIdempotencyKey({
            bookingId: booking.id,
            paymentMode: paymentPlan.paymentMode,
            amountDueNow: paymentPlan.amountDueNow,
            testMode: testPaymentsEnabled,
            payload: preference,
        });
        if (!idempotency.payerAware) {
            opsLog('warn', 'MP_HOSTED_CHECKOUT_IDEMPOTENCY_WITHOUT_SECRET', {
                bookingIdShort: booking.id.slice(0, 8),
            });
        }

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'X-Idempotency-Key': idempotency.key,
                ...(deviceId ? { 'X-meli-session-id': deviceId } : {}),
            },
            body: JSON.stringify(preference),
        });
        const result = await response.json().catch(() => ({}));
        const checkoutInitPoint = result?.init_point;
        if (!response.ok || !checkoutInitPoint) {
            const providerDetails = process.env.NODE_ENV === 'production'
                ? {}
                : {
                      providerError: String(result?.error || ''),
                      providerMessage: String(result?.message || ''),
                      providerCause: Array.isArray(result?.cause)
                          ? result.cause.map((cause: any) => ({
                                code: String(cause?.code || ''),
                                description: String(cause?.description || ''),
                            }))
                          : [],
                  };
            opsLog('error', 'MP_HOSTED_CHECKOUT_CREATE_FAILED', {
                bookingId: booking.id,
                status: response.status,
                error: result?.error,
                // Só códigos: a mensagem crua do MP pode ecoar dados do pagador (e-mail, CPF).
                causeCodes: Array.isArray(result?.cause)
                    ? result.cause.map((cause: any) => String(cause?.code || '')).filter(Boolean)
                    : [],
            });
            return NextResponse.json({
                error: 'PAYMENT_LINK_CREATE_FAILED',
                message: 'Não foi possível abrir o ambiente de pagamento do Mercado Pago.',
                ...providerDetails,
            }, { status: response.ok ? 502 : response.status });
        }

        // Uma preferência nova NÃO invalida a anterior no MP. O providerId atual pode ser uma
        // preferência ou um pagamento (o webhook grava o id do pagamento); o registro preserva o
        // vínculo para reconciliação (o webhook concilia pela external_reference = id da reserva).
        const previousProviderId = String(booking.payment?.providerId || '');
        const newPreferenceId = String(result.id || '');
        if (previousProviderId && previousProviderId !== newPreferenceId) {
            opsLog('info', 'MP_HOSTED_CHECKOUT_PREFERENCE_REPLACED', {
                bookingIdShort: booking.id.slice(0, 8),
                previousProvider: booking.payment?.provider || null,
                previousProviderId,
                previousPaymentStatus: booking.payment?.status || null,
                preferenceId: newPreferenceId,
            });
        }

        await prisma.$transaction([
            prisma.payment.upsert({
                where: { bookingId: booking.id },
                update: {
                    amount: paymentPlan.amountDueNow,
                    totalAmount,
                    remainingAmount: paymentPlan.remainingAmount,
                    paymentMode: paymentPlan.paymentMode,
                    balanceDueAt: paymentPlan.balanceDueAt,
                    balanceDueDate: paymentPlan.balanceDueDate,
                    status: 'PENDING',
                    provider: 'MERCADOPAGO_CHECKOUT_PRO',
                    providerId: String(result.id || ''),
                    method: null,
                    cardBrand: null,
                    installments: null,
                },
                create: {
                    bookingId: booking.id,
                    amount: paymentPlan.amountDueNow,
                    totalAmount,
                    remainingAmount: paymentPlan.remainingAmount,
                    paymentMode: paymentPlan.paymentMode,
                    balanceDueAt: paymentPlan.balanceDueAt,
                    balanceDueDate: paymentPlan.balanceDueDate,
                    status: 'PENDING',
                    provider: 'MERCADOPAGO_CHECKOUT_PRO',
                    providerId: String(result.id || ''),
                },
            }),
            prisma.booking.update({
                where: { id: booking.id },
                data: {
                    funnelStage: 'PAYMENT_PENDING',
                    funnelUpdatedAt: new Date(),
                    lastErrorMessage: null,
                },
            }),
        ]);

        return NextResponse.json({ initPoint: checkoutInitPoint });
    } catch (error) {
        if (error instanceof RequestGuardError) {
            return NextResponse.json({ error: error.code }, { status: error.status });
        }
        opsLog('error', 'MP_HOSTED_CHECKOUT_UNEXPECTED_ERROR', {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({
            error: 'PAYMENT_LINK_UNEXPECTED_ERROR',
            message: 'Não foi possível abrir o ambiente de pagamento do Mercado Pago.',
        }, { status: 500 });
    }
}
