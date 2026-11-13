import { NextResponse } from 'next/server';

import {
    ASAAS_MAX_INSTALLMENTS,
    buildAsaasCustomerData,
    createAsaasCheckout,
    getAsaasApiKey,
    getAsaasCheckoutUrl,
    getAsaasErrorMessage,
} from '@/lib/asaas/client';
import { parseBillingAddress } from '@/lib/billing-address';
import {
    getBookingAccessCookieName,
    getBookingAccessCookieOptions,
    signBookingAccessToken,
} from '@/lib/booking-access';
import { getBookingPaymentWindow, PAYMENT_WINDOW_MESSAGES } from '@/lib/booking-payment-window';
import { isValidCpf, normalizeCpf } from '@/lib/cpf';
import { resolveCheckoutPayer } from '@/lib/mercadopago/checkout-payer';
import { hasPaymentUnderReview } from '@/lib/mercadopago/payment-under-review';
import { opsLog } from '@/lib/ops-log';
import {
    DEFAULT_PARTIAL_PAYMENT_SETTINGS,
    calculatePaymentPlan,
    normalizePartialPaymentSettings,
    type PaymentMode,
} from '@/lib/partial-payment';
import prisma from '@/lib/prisma';
import { consumeRequestLimit, readJsonBody, RequestGuardError } from '@/lib/request-guard';

const PARTIAL_PAYMENT_SETTINGS_ID = 'default';

const INVALID_PAYER_DATA_MESSAGES: Record<string, string> = {
    name: 'Informe nome e sobrenome do responsável pelo pagamento, como constam no CPF.',
    email: 'Informe um e-mail válido para o responsável pelo pagamento ou deixe o campo em branco.',
    phone: 'Informe um telefone válido com DDD para o responsável pelo pagamento ou deixe o campo em branco.',
};

function getPublicBaseUrl(request: Request) {
    const configured = String(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '')
        .trim().replace(/\/+$/, '');
    if (configured.startsWith('https://') || configured.startsWith('http://localhost')) return configured;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    return host ? `${protocol}://${host}` : '';
}

/**
 * Checkout do hóspede no Asaas (Pix ou cartão, tela hospedada pelo Asaas).
 * O valor vem do servidor (plano de pagamento); o link vence junto com o prazo da reserva.
 */
export async function POST(request: Request) {
    try {
        const body = await readJsonBody<any>(request, 8 * 1024);
        const bookingId = String(body?.bookingId || '').trim();
        const guestEmail = String(body?.guestEmail || '').trim().toLowerCase();
        const payerCpf = normalizeCpf(body?.payerCpf);
        const paymentMode: PaymentMode = body?.paymentMode === 'PARTIAL' ? 'PARTIAL' : 'FULL';
        if (!bookingId || !guestEmail) {
            return NextResponse.json({ error: 'BOOKING_IDENTIFICATION_REQUIRED' }, { status: 400 });
        }
        if (!isValidCpf(payerCpf)) {
            return NextResponse.json({
                error: 'INVALID_PAYER_IDENTIFICATION',
                message: 'Informe um CPF válido para continuar com o pagamento.',
            }, { status: 400 });
        }

        const rateLimit = consumeRequestLimit({
            request, scope: 'asaas-checkout', discriminator: `${bookingId}:${guestEmail}`, limit: 8, windowMs: 10 * 60_000,
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
        const settingsRow = await prisma.partialPaymentSettings.findUnique({ where: { id: PARTIAL_PAYMENT_SETTINGS_ID } });
        const settings = normalizePartialPaymentSettings(settingsRow ? {
            enabled: settingsRow.enabled,
            percentage: settingsRow.percentage,
            minimumBookingAmount: settingsRow.minimumBookingAmount === null ? null : Number(settingsRow.minimumBookingAmount),
            minimumLeadTimeDays: settingsRow.minimumLeadTimeDays,
            balanceDueAt: settingsRow.balanceDueAt === 'BEFORE_CHECK_IN' ? 'BEFORE_CHECK_IN' : 'CHECK_IN',
            balanceDueDaysBeforeCheckIn: settingsRow.balanceDueDaysBeforeCheckIn,
            defaultPaymentMode: settingsRow.defaultPaymentMode === 'PARTIAL' ? 'PARTIAL' : 'FULL',
        } : DEFAULT_PARTIAL_PAYMENT_SETTINGS);
        const paymentPlan = calculatePaymentPlan({ settings, totalAmount, checkIn: booking.checkIn, paymentMode });
        if (!paymentPlan.ok) return NextResponse.json({ error: paymentPlan.error }, { status: 400 });

        // Mesma validação de pagador do formulário: nome, e-mail, telefone e CPF de um terceiro
        // precisam ser coerentes. Só o hóspede vai pré-preenchido ao Asaas (ver customerData abaixo).
        const payerResolution = resolveCheckoutPayer({ payer: body?.payer, cpf: payerCpf, guest: booking.guest });
        if (!payerResolution.ok) {
            if (payerResolution.error === 'INVALID_PAYER_IDENTIFICATION') {
                return NextResponse.json({
                    error: 'INVALID_PAYER_IDENTIFICATION',
                    message: 'Informe um CPF válido para continuar com o pagamento.',
                }, { status: 400 });
            }
            return NextResponse.json({
                error: 'INVALID_PAYER_DATA',
                field: payerResolution.field,
                message: INVALID_PAYER_DATA_MESSAGES[payerResolution.field] || 'Revise os dados do responsável pelo pagamento.',
            }, { status: 400 });
        }

        // Cartão em análise ainda pode ser aprovado: outro checkout permitiria cobrar duas vezes.
        if (await hasPaymentUnderReview(booking.id)) {
            return NextResponse.json({
                error: 'PAYMENT_UNDER_REVIEW',
                message: 'Já existe um pagamento desta reserva em análise. Aguarde a conclusão antes de tentar novamente.',
            }, { status: 409 });
        }

        const publicBaseUrl = getPublicBaseUrl(request);
        if (!getAsaasApiKey() || !publicBaseUrl) {
            opsLog('error', 'ASAAS_CHECKOUT_CONFIG_ERROR', { hasApiKey: Boolean(getAsaasApiKey()), hasBaseUrl: Boolean(publicBaseUrl) });
            return NextResponse.json({ error: 'PAYMENT_CONFIGURATION_ERROR' }, { status: 500 });
        }
        const accessToken = await signBookingAccessToken(booking.id);
        // No Asaas o token vai na query (o retorno do checkout não preserva o hash).
        const confirmationUrl = new URL(`/reservar/confirmacao/${booking.id}`, publicBaseUrl);
        if (accessToken) confirmationUrl.searchParams.set('access', accessToken);

        // Hóspede pagando com endereço completo: checkout abre preenchido. Terceiro pagando ou sem
        // endereço: sem customerData, e o pagador preenche tudo na tela do Asaas.
        const billing = payerResolution.type === 'GUEST' ? parseBillingAddress(body?.billing) : null;
        const customerData = billing
            ? buildAsaasCustomerData({ ...booking.guest, cpfCnpj: payerCpf }, billing)
            : null;

        const stayNights = Math.max(1, Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000));
        const checkIn = booking.checkIn.toISOString().slice(0, 10);
        const checkOut = booking.checkOut.toISOString().slice(0, 10);
        const { response, result } = await createAsaasCheckout({
            billingTypes: ['PIX', 'CREDIT_CARD'],
            chargeTypes: ['DETACHED', 'INSTALLMENT'],
            installment: { maxInstallmentCount: ASAAS_MAX_INSTALLMENTS },
            minutesToExpire: paymentWindow.minutesToExpire,
            externalReference: booking.id,
            callback: {
                successUrl: confirmationUrl.toString(),
                cancelUrl: confirmationUrl.toString(),
                expiredUrl: confirmationUrl.toString(),
            },
            items: [{
                name: `Reserva ${booking.id.slice(0, 8)}`,
                description: `Pousada Delplata - ${booking.roomType.name}: ${stayNights} diária(s), ${checkIn} a ${checkOut}${booking.pets > 0 ? `, ${booking.pets} pet(s)` : ''}`.slice(0, 500),
                quantity: 1,
                value: Number(paymentPlan.amountDueNow.toFixed(2)),
            }],
        }, customerData, { bookingId });
        if (!response.ok || !result?.id) {
            const message = getAsaasErrorMessage(result) || 'O Asaas não conseguiu gerar o link de pagamento.';
            opsLog('error', 'ASAAS_CHECKOUT_CREATE_FAILED', { bookingId, status: response.status, message });
            return NextResponse.json({
                error: 'PAYMENT_LINK_CREATE_FAILED',
                message: 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.',
            }, { status: response.ok ? 502 : response.status });
        }

        const previousProviderId = String(booking.payment?.providerId || '');
        if (previousProviderId && previousProviderId !== String(result.id)) {
            opsLog('info', 'ASAAS_CHECKOUT_REPLACED', {
                bookingIdShort: booking.id.slice(0, 8),
                previousProvider: booking.payment?.provider || null,
                previousProviderId,
                previousPaymentStatus: booking.payment?.status || null,
                checkoutId: String(result.id),
            });
        }

        await prisma.$transaction([
            prisma.payment.upsert({
                where: { bookingId },
                update: {
                    amount: paymentPlan.amountDueNow, totalAmount, remainingAmount: paymentPlan.remainingAmount,
                    paymentMode: paymentPlan.paymentMode, balanceDueAt: paymentPlan.balanceDueAt,
                    balanceDueDate: paymentPlan.balanceDueDate, status: 'PENDING', provider: 'ASAAS',
                    providerId: String(result.id), method: null, cardBrand: null, installments: null,
                },
                create: {
                    bookingId, amount: paymentPlan.amountDueNow, totalAmount,
                    remainingAmount: paymentPlan.remainingAmount, paymentMode: paymentPlan.paymentMode,
                    balanceDueAt: paymentPlan.balanceDueAt, balanceDueDate: paymentPlan.balanceDueDate,
                    status: 'PENDING', provider: 'ASAAS', providerId: String(result.id),
                },
            }),
            prisma.booking.update({
                where: { id: bookingId },
                data: { funnelStage: 'PAYMENT_PENDING', funnelUpdatedAt: new Date(), lastErrorMessage: null },
            }),
        ]);

        const checkoutResponse = NextResponse.json({
            initPoint: getAsaasCheckoutUrl(String(result.id)),
            bookingAccessToken: accessToken,
        });
        if (accessToken) {
            checkoutResponse.cookies.set(
                getBookingAccessCookieName(booking.id),
                accessToken,
                getBookingAccessCookieOptions(booking.id)
            );
        }
        return checkoutResponse;
    } catch (error) {
        if (error instanceof RequestGuardError) return NextResponse.json({ error: error.code }, { status: error.status });
        opsLog('error', 'ASAAS_CHECKOUT_UNEXPECTED_ERROR', { message: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'PAYMENT_LINK_UNEXPECTED_ERROR', message: 'Não foi possível abrir o pagamento agora.' }, { status: 500 });
    }
}
