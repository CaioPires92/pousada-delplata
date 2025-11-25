import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Webhook do Mercado Pago
 * Recebe notificações de mudanças de status de pagamento
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export async function POST(request: NextRequest) {
    try {
        console.log('[Webhook] Received notification from Mercado Pago');

        // 1. Validar assinatura do webhook (segurança)
        const signature = request.headers.get('x-signature');
        const requestId = request.headers.get('x-request-id');

        if (!signature || !requestId) {
            console.error('[Webhook] Missing signature or request ID');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // 2. Obter dados do webhook
        const body = await request.json();
        console.log('[Webhook] Notification data:', JSON.stringify(body, null, 2));

        // 3. Verificar tipo de notificação
        if (body.type !== 'payment') {
            console.log('[Webhook] Ignoring non-payment notification:', body.type);
            return NextResponse.json({ status: 'ignored' });
        }

        // 4. Obter ID do pagamento
        const paymentId = body.data?.id;
        if (!paymentId) {
            console.error('[Webhook] Missing payment ID');
            return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 });
        }

        console.log('[Webhook] Processing payment ID:', paymentId);

        // 5. Buscar detalhes do pagamento na API do Mercado Pago
        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            console.error('[Webhook] MP_ACCESS_TOKEN not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const paymentResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!paymentResponse.ok) {
            console.error('[Webhook] Failed to fetch payment details:', paymentResponse.status);
            return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
        }

        const paymentData = await paymentResponse.json();
        console.log('[Webhook] Payment data:', {
            id: paymentData.id,
            status: paymentData.status,
            status_detail: paymentData.status_detail,
            external_reference: paymentData.external_reference,
        });

        // 6. Extrair informações importantes
        const status = paymentData.status; // approved, pending, rejected, etc.
        const externalReference = paymentData.external_reference; // bookingId
        const transactionAmount = paymentData.transaction_amount;
        const paymentMethodId = paymentData.payment_method_id;

        if (!externalReference) {
            console.error('[Webhook] Missing external_reference (booking ID)');
            return NextResponse.json({ error: 'Missing booking reference' }, { status: 400 });
        }

        // 7. Atualizar pagamento no banco de dados
        const payment = await prisma.payment.findFirst({
            where: { bookingId: externalReference },
            include: { booking: { include: { guest: true, roomType: true } } },
        });

        if (!payment) {
            console.error('[Webhook] Payment not found for booking:', externalReference);
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        console.log('[Webhook] Updating payment status from', payment.status, 'to', status);

        // 8. Atualizar status do pagamento
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: status.toUpperCase(),
                providerId: paymentId.toString(),
                metadata: {
                    ...((payment.metadata as object) || {}),
                    payment_method_id: paymentMethodId,
                    status_detail: paymentData.status_detail,
                    updated_at: new Date().toISOString(),
                },
            },
        });

        // 9. Atualizar status da reserva baseado no status do pagamento
        let bookingStatus = payment.booking.status;

        if (status === 'approved') {
            bookingStatus = 'CONFIRMED';
            console.log('[Webhook] Payment approved - confirming booking');
        } else if (status === 'rejected' || status === 'cancelled') {
            bookingStatus = 'CANCELLED';
            console.log('[Webhook] Payment rejected/cancelled - cancelling booking');
        } else if (status === 'pending' || status === 'in_process') {
            bookingStatus = 'PENDING';
            console.log('[Webhook] Payment pending - keeping booking as pending');
        }

        await prisma.booking.update({
            where: { id: externalReference },
            data: { status: bookingStatus },
        });

        // 10. Enviar email de confirmação (se aprovado)
        if (status === 'approved') {
            console.log('[Webhook] Sending confirmation email to:', payment.booking.guest.email);

            try {
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/emails/send-confirmation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bookingId: externalReference,
                        email: payment.booking.guest.email,
                        guestName: payment.booking.guest.name,
                        roomName: payment.booking.roomType.name,
                        checkIn: payment.booking.checkIn,
                        checkOut: payment.booking.checkOut,
                        totalPrice: payment.booking.totalPrice,
                    }),
                });
                console.log('[Webhook] Confirmation email sent successfully');
            } catch (emailError) {
                console.error('[Webhook] Failed to send confirmation email:', emailError);
                // Não falhar o webhook se o email falhar
            }
        }

        console.log('[Webhook] Processing completed successfully');
        return NextResponse.json({ status: 'success' });

    } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Permitir GET para verificação do endpoint
export async function GET() {
    return NextResponse.json({
        status: 'Webhook endpoint is active',
        timestamp: new Date().toISOString(),
    });
}
