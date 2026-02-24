import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';
import { sendBookingConfirmationEmail, sendBookingCreatedAlertEmail } from '@/lib/email';
import { sendGa4PurchaseServerEvent } from '@/lib/ga4-measurement';

type MercadoPagoCause = {
    code?: number | string;
    description?: string;
    data?: string;
};

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

function getMinTransactionAmount() {
    const parsed = Number.parseFloat(String(process.env.MP_MIN_TRANSACTION_AMOUNT ?? '1'));
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
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

function getMercadoPagoErrorMessage(error: any) {
    const causes: MercadoPagoCause[] = Array.isArray(error?.cause) ? error.cause : [];
    const firstCause = causes.find((c) => String(c?.description || '').trim().length > 0);
    if (firstCause?.description) return String(firstCause.description);

    const message = String(error?.message || '').trim();
    return message || 'Erro ao processar pagamento';
}

export async function POST(request: Request) {
    let ctxBookingId: string | undefined;
    let ctxRequestedAmount: number | undefined;

    try {
        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            return NextResponse.json({ error: 'MP_ACCESS_TOKEN ausente' }, { status: 500 });
        }

        const body = await request.json();
        const { bookingId, transaction_amount, description, ...formData } = body || {};

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
        if (!paymentMethodId || typeof paymentMethodId !== 'string') {
            return NextResponse.json({ error: 'payment_method_id ausente' }, { status: 400 });
        }
        if (!payerEmail || typeof payerEmail !== 'string') {
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
                payerEmail,
            });
            return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
        }

        if (booking.payment?.status === 'APPROVED' || booking.payment?.status === 'PENDING') {
            opsLog('warn', 'MP_PAYMENT_DUPLICATE_BLOCK', {
                bookingId,
                paymentStatus: booking.payment?.status,
            });
            return NextResponse.json({ error: 'Pagamento já existe para esta reserva' }, { status: 409 });
        }

        const bookingAmount = Number(booking.totalPrice);
        const requestedAmount = Number(transaction_amount);
        const minTransactionAmount = getMinTransactionAmount();

        ctxRequestedAmount = requestedAmount;
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
            return NextResponse.json({ error: 'transaction_amount inválido' }, { status: 400 });
        }

        if (bookingAmount < minTransactionAmount || requestedAmount < minTransactionAmount) {
            opsLog('warn', 'MP_PAYMENT_AMOUNT_BELOW_MINIMUM', {
                bookingId,
                bookingAmount,
                requestedAmount,
                minTransactionAmount,
                paymentMethodId,
                paymentTypeId,
            });
            return NextResponse.json(
                {
                    error: 'transaction_amount inválido',
                    message: `Este valor nao permite pagamento com cartao. Escolha Pix ou aumente o valor da reserva (minimo R$ ${formatBrl(minTransactionAmount)}).`,
                },
                { status: 400 }
            );
        }

        if (Math.abs(bookingAmount - requestedAmount) > 0.01) {
            opsLog('warn', 'MP_PAYMENT_AMOUNT_MISMATCH', {
                bookingId,
                bookingAmount,
                requestedAmount,
                paymentMethodId,
                paymentTypeId,
                installments: normalizedInstallments,
                payerEmail,
            });
            return NextResponse.json({ error: 'Valor divergente da reserva' }, { status: 400 });
        }

        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const result = await payment.create({
            body: {
                ...formData,
                transaction_amount: requestedAmount,
                description: description || `Reserva ${bookingId}`,
                external_reference: bookingId,
            },
        });

        const normalizedStatus = String(result.status || 'PENDING').toUpperCase();

        try {
            await prisma.payment.upsert({
                where: { bookingId },
                update: {
                    amount: requestedAmount,
                    status: normalizedStatus,
                    provider: 'MERCADOPAGO',
                    providerId: String(result.id || ''),
                    method: normalizedPaymentMethod,
                    cardBrand: normalizedCardBrand,
                    installments: normalizedInstallments,
                },
                create: {
                    bookingId,
                    amount: requestedAmount,
                    status: normalizedStatus,
                    provider: 'MERCADOPAGO',
                    providerId: String(result.id || ''),
                    method: normalizedPaymentMethod,
                    cardBrand: normalizedCardBrand,
                    installments: normalizedInstallments,
                },
            });
        } catch (e) {
            console.error('Aviso: erro ao registrar pagamento', e);
        }

        if (normalizedStatus === 'APPROVED') {
            await prisma.booking.updateMany({
                where: { id: bookingId, status: 'PENDING' },
                data: { status: 'CONFIRMED' },
            });

            try {
                await sendBookingConfirmationEmail({
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
                    adults: booking.adults,
                    children: booking.children,
                    childrenAges: booking.childrenAges,
                    bookingStatus: 'CONFIRMED',
                    paymentStatus: 'APPROVED',
                    bookingCreatedAt: booking.createdAt,
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

            await sendGa4PurchaseServerEvent({
                transactionId: booking.id,
                value: Number(booking.totalPrice),
                currency: 'BRL',
                itemId: booking.roomType?.id || booking.roomTypeId,
                itemName: booking.roomType?.name || 'Hospedagem',
                userId: booking.guest?.id || booking.guestId,
                source: 'mp_payment_route',
            });
        } else if (['REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK'].includes(normalizedStatus)) {
            await prisma.booking.updateMany({
                where: { id: bookingId, status: 'PENDING' },
                data: { status: 'CANCELLED' },
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

        opsLog('error', 'MP_PAYMENT_CREATE_FAILED', {
            bookingId: ctxBookingId,
            requestedAmount: ctxRequestedAmount,
            status: error?.status,
            message: error?.message,
            cause: error?.cause,
        });
        console.error('Erro Mercado Pago:', error);
        return NextResponse.json({ error: 'Erro ao processar pagamento', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}











