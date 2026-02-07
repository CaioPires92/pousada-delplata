import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            return NextResponse.json({ error: 'MP_ACCESS_TOKEN ausente' }, { status: 500 });
        }

        const body = await request.json();
        const {
            bookingId,
            transaction_amount,
            description,
            ...formData
        } = body || {};

        if (!bookingId || !transaction_amount) {
            return NextResponse.json({ error: 'Dados insuficientes para pagamento' }, { status: 400 });
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

        // Atualiza/insere pagamento no banco
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
        console.error('Erro Mercado Pago:', error);
        return NextResponse.json(
            { error: 'Erro ao processar pagamento', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}
