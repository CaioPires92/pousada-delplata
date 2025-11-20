import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        console.log('Webhook Mercado Pago received:', body);

        // Mercado Pago envia o tipo e ID do recurso
        const { type, data } = body;

        // Só processar notificações de pagamento
        if (type !== 'payment') {
            return NextResponse.json({ message: 'Notification type not handled' });
        }

        const paymentId = data.id;

        if (!paymentId) {
            return NextResponse.json({ error: 'Payment ID not provided' }, { status: 400 });
        }

        // Configurar Mercado Pago
        const accessToken = process.env.MP_ACCESS_TOKEN;

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Mercado Pago not configured' },
                { status: 500 }
            );
        }

        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        // Buscar detalhes do pagamento
        const paymentInfo = await payment.get({ id: paymentId });

        console.log('Payment info:', paymentInfo);

        // Extrair o external_reference (nosso bookingId)
        const bookingId = paymentInfo.external_reference;

        if (!bookingId) {
            console.error('No booking ID in payment');
            return NextResponse.json({ error: 'No booking reference' }, { status: 400 });
        }

        // Buscar a reserva
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
        });

        if (!booking) {
            console.error('Booking not found:', bookingId);
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Mapear status do MP para nosso status
        let bookingStatus = booking.status;
        let paymentStatus = 'PENDING';

        switch (paymentInfo.status) {
            case 'approved':
                bookingStatus = 'CONFIRMED';
                paymentStatus = 'APPROVED';
                break;
            case 'rejected':
            case 'cancelled':
                bookingStatus = 'CANCELLED';
                paymentStatus = 'REJECTED';
                break;
            case 'in_process':
            case 'pending':
                paymentStatus = 'PENDING';
                break;
            default:
                paymentStatus = 'PENDING';
        }

        // Atualizar a reserva
        await prisma.booking.update({
            where: { id: bookingId },
            data: { status: bookingStatus },
        });

        // Atualizar o pagamento
        if (booking.payment) {
            await prisma.payment.update({
                where: { id: booking.payment.id },
                data: {
                    status: paymentStatus,
                    providerId: paymentId.toString(),
                },
            });
        }

        console.log(`Booking ${bookingId} updated to ${bookingStatus}`);

        return NextResponse.json({
            message: 'Webhook processed successfully',
            bookingStatus,
            paymentStatus
        });

    } catch (error: any) {
        console.error('Error processing webhook:', error);
        return NextResponse.json(
            { error: 'Error processing webhook', details: error.message },
            { status: 500 }
        );
    }
}

// Mercado Pago também faz requests GET para validar a URL
export async function GET() {
    return NextResponse.json({ message: 'Webhook endpoint active' });
}
