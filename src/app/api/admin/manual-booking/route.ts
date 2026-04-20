import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        // 1. Verificar autenticação de admin
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();
        const {
            guestName,
            guestEmail,
            guestPhone,
            checkIn,
            checkOut,
            roomTypeId,
            totalPrice,
            adults = 2,
            children = 0
        } = body;

        // Validação básica
        if (!guestName || !guestEmail || !checkIn || !checkOut || !roomTypeId || !totalPrice) {
            return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
        }

        const numericTotalPrice = Number(totalPrice);
        const numericAdults = Number(adults);
        const numericChildren = Number(children);

        if (isNaN(numericTotalPrice) || isNaN(numericAdults) || isNaN(numericChildren)) {
            return NextResponse.json({ error: 'Valores numéricos inválidos' }, { status: 400 });
        }

        // 2. Criar ou encontrar Hóspede (Manualmente já que email pode não ser único no schema)
        let guest = await prisma.guest.findFirst({
            where: { email: guestEmail }
        });

        if (guest) {
            guest = await prisma.guest.update({
                where: { id: guest.id },
                data: {
                    name: guestName,
                    phone: guestPhone || '',
                },
            });
        } else {
            guest = await prisma.guest.create({
                data: {
                    name: guestName,
                    email: guestEmail,
                    phone: guestPhone || '',
                },
            });
        }

        // 3. Criar Reserva (Booking)
        // Nota: totalPrice é o valor manual enviado pelo admin
        const booking = await prisma.booking.create({
            data: {
                guestId: guest.id,
                roomTypeId: roomTypeId,
                checkIn: new Date(checkIn),
                checkOut: new Date(checkOut),
                totalPrice: numericTotalPrice,
                status: 'PENDING',
                adults: numericAdults,
                children: numericChildren,
            },
            include: {
                roomType: true,
                guest: true,
            }
        });

        // 4. Criar Preferência no Mercado Pago
        const accessToken = process.env.MP_ACCESS_TOKEN;
        
        // Detectar a URL base para os redirecionamentos (back_urls)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            `https://${process.env.VERCEL_URL}`;
        
        // URL base pública específica para o Webhook (caso baseUrl local seja http:// localhost)
        const webhookBaseUrl = (baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1'))
            ? (process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`)
            : baseUrl;

        const phoneNumber = booking.guest.phone.replace(/\D/g, '');

        const preferenceData = {
            items: [
                {
                    id: booking.roomType.id,
                    title: `Reserva Manual - ${booking.roomType.name}`,
                    description: `Hóspede: ${booking.guest.name} | Período: ${checkIn} a ${checkOut}`,
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
                success: `${baseUrl}/admin/reservas`,
                failure: `${baseUrl}/admin/reserva-manual?error=payment_failed&bookingId=${booking.id}`,
                pending: `${baseUrl}/admin/reservas`,
            },
            auto_return: 'approved',
            external_reference: booking.id,
            notification_url: webhookBaseUrl.startsWith('https') ? `${webhookBaseUrl}/api/webhooks/mercadopago` : undefined,
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
            const errorData = await apiResponse.json().catch(() => ({ message: 'Erro ao criar preferência' }));
            return NextResponse.json(
                { error: 'Falha ao criar link de pagamento', details: errorData.message },
                { status: apiResponse.status }
            );
        }

        const result = await apiResponse.json();

        // 5. Registrar tentativa de pagamento
        try {
            await prisma.payment.create({
                data: {
                    bookingId: booking.id,
                    amount: numericTotalPrice,
                    status: 'PENDING',
                    provider: 'MERCADOPAGO',
                    providerId: result.id,
                },
            });
        } catch (e) {
            console.error('Erro ao registrar Payment:', e);
        }

        return NextResponse.json({
            bookingId: booking.id,
            initPoint: result.init_point
        });

    } catch (error: any) {
        console.error('SERVER-SIDE ERROR [Manual Booking]:', {
            message: error.message,
            stack: error.stack
        });
        return NextResponse.json({ 
            error: 'Erro interno do servidor', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        }, { status: 500 });
    }
}
