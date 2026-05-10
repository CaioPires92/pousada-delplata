import { NextResponse } from 'next/server';
import { handleMercadoPagoWebhook } from '@/lib/mercadopago/webhook-handler';

export async function POST(request: Request) {
    return handleMercadoPagoWebhook(request);
}

// Mercado Pago também faz requests GET para validar a URL
export async function GET() {
    return NextResponse.json({ message: 'Endpoint do webhook ativo' });
}
