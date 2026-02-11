import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';

type MercadoPagoCause = {
    code?: number | string;
    description?: string;
    data?: string;
};

function detectPixKeyNotEnabled(error: any) {
    const status = Number(error?.status || 0);
    const causes: MercadoPagoCause[] = Array.isArray(error?.cause) ? error.cause : [];
    const has13253 = causes.some((c) => Number(c?.code) === 13253);
    const hasMessage = causes.some((c) =>
        String(c?.description || '')
            .toLowerCase()
            .includes('without key enabled for qr')
    );

    return status === 400 && (has13253 || hasMessage);
}

export async function POST(request: Request) {
    try {
        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            return NextResponse.json({ error: 'MP_ACCESS_TOKEN ausente' }, { status: 500 });
        }

        const body = await request.json();
        const { bookingId, transaction_amount, description, ...formData } = body || {};

        if (!bookingId || !transaction_amount) {
            return NextResponse.json({ error: 'Dados insuficientes para pagamento' }, { status: 400 });
        }

        const paymentMethodId = formData?.payment_method_id;
        const payerEmail = formData?.payer?.email;
        if (!paymentMethodId || typeof paymentMethodId !== 'string') {
            return NextResponse.json({ error: 'payment_method_id ausente' }, { status: 400 });
        }
        if (!payerEmail || typeof payerEmail !== 'string') {
            return NextResponse.json({ error: 'payer.email ausente' }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
        });
        if (!booking) {
            opsLog('warn', 'MP_PAYMENT_INVALID_BOOKING', {
                bookingId,
                paymentMethodId,
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
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
            return NextResponse.json({ error: 'transaction_amount inválido' }, { status: 400 });
        }
        if (Math.abs(bookingAmount - requestedAmount) > 0.01) {
            opsLog('warn', 'MP_PAYMENT_AMOUNT_MISMATCH', {
                bookingId,
                bookingAmount,
                requestedAmount,
                paymentMethodId,
                payerEmail,
            });
            return NextResponse.json({ error: 'Valor divergente da reserva' }, { status: 400 });
        }

        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const result = await payment.create({
            body: {
                ...formData,
                transaction_amount: Number(transaction_amount),
                description: description || `Reserva ${bookingId}`,
                external_reference: bookingId,
            },
        });

        try {
            await prisma.payment.upsert({
                where: { bookingId },
                update: {
                    amount: Number(transaction_amount),
                    status: result.status || 'PENDING',
                    provider: 'MERCADOPAGO',
                    providerId: String(result.id || ''),
                },
                create: {
                    bookingId,
                    amount: Number(transaction_amount),
                    status: result.status || 'PENDING',
                    provider: 'MERCADOPAGO',
                    providerId: String(result.id || ''),
                },
            });
        } catch (e) {
            console.error('Aviso: erro ao registrar pagamento', e);
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
                    message:
                        'Pix indisponível nesta conta do Mercado Pago. Ative uma chave Pix na conta recebedora ou use cartão.',
                },
                { status: 400 }
            );
        }

        console.error('Erro Mercado Pago:', error);
        return NextResponse.json(
            { error: 'Erro ao processar pagamento', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}
