import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bookingId } = body;

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { roomType: true, guest: true },
        });

        if (!booking) return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });

        const accessToken = process.env.MP_ACCESS_TOKEN;
        // Tenta usar a variável que você já tem configurada na Vercel
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            `https://${process.env.VERCEL_URL}`;

        const phoneNumber = booking.guest.phone.replace(/\D/g, '');

        const preferenceData = {
            items: [
                {
                    id: booking.roomType.id,
                    title: `Pousada Delplata - ${booking.roomType.name}`,
                    quantity: 1,
                    unit_price: Number(booking.totalPrice),
                    currency_id: 'BRL',
                },
            ],
            payer: {
                name: booking.guest.name,
                email: booking.guest.email,
                phone: {
                    area_code: phoneNumber.substring(0, 2) || '11',
                    number: phoneNumber.substring(2) || '999999999',
                },
            },
            back_urls: {
                success: `${baseUrl}/reservar/confirmacao/${booking.id}`,
                failure: `${baseUrl}/reservar/confirmacao/${booking.id}`,
                pending: `${baseUrl}/reservar/confirmacao/${booking.id}`,
            },
            auto_return: 'approved',
            external_reference: booking.id,
            notification_url: baseUrl.startsWith('https') ? `${baseUrl}/api/webhooks/mercadopago` : undefined,
        };

        const apiResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(preferenceData),
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json().catch(() => ({ message: 'Erro desconhecido' }));
            return NextResponse.json(
                {
                    error: 'Falha ao criar preferência de pagamento',
                    details: errorData.message,
                },
                { status: apiResponse.status }
            );
        }
        const result = await apiResponse.json();

        // Registro opcional de pagamento no banco
        try {
            await prisma.payment.create({
                data: {
                    bookingId: booking.id,
                    amount: Number(booking.totalPrice),
                    status: 'PENDING',
                    provider: 'MERCADOPAGO',
                    providerId: result.id,
                },
            });
        } catch (e) { console.error('Aviso: Tabela Payment não encontrada ou erro na gravação.'); }

        return NextResponse.json({ preferenceId: result.id, initPoint: result.init_point });

    } catch (error: any) {
        return NextResponse.json({ error: 'Erro ao criar preferência de pagamento', details: error.message }, { status: 500 });
    }
}
