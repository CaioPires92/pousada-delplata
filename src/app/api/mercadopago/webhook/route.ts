import { NextResponse } from 'next/server';
import { handleMercadoPagoWebhook } from '@/lib/mercadopago/webhook-handler';

/**
 * Webhook do Mercado Pago
 * Recebe notificações de mudanças de status de pagamento
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export async function POST(request: Request) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LEGACY_MP_WEBHOOK !== 'true') {
        return NextResponse.json(
            { error: 'Webhook obsoleto. Use /api/webhooks/mercadopago' },
            { status: 410 }
        );
    }
    return handleMercadoPagoWebhook(request);
}

// Permitir GET para verificação do endpoint
export async function GET() {
    return NextResponse.json({
        status: 'Endpoint do webhook ativo',
        timestamp: new Date().toISOString(),
    });
}
