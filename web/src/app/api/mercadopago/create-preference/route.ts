import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bookingId } = body;

        if (!bookingId) {
            return NextResponse.json(
                { error: 'bookingId is required' },
                { status: 400 }
            );
        }

        // Buscar a reserva
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                roomType: true,
                guest: true,
            },
        });

        if (!booking) {
            return NextResponse.json(
                { error: 'Booking not found' },
                { status: 404 }
            );
        }

        // Configurar Mercado Pago
        const accessToken = process.env.MP_ACCESS_TOKEN;

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Mercado Pago not configured' },
                { status: 500 }
            );
        }

        const client = new MercadoPagoConfig({
            accessToken,
            options: { timeout: 5000 }
        });

        const preference = new Preference(client);

        // Criar preferência de pagamento
        const checkInDate = new Date(booking.checkIn).toLocaleDateString('pt-BR');
        const checkOutDate = new Date(booking.checkOut).toLocaleDateString('pt-BR');

        // Get base URL from environment or use localhost
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

        // Validate phone number
        const phoneNumber = booking.guest.phone.replace(/\D/g, ''); // Remove non-digits
        if (phoneNumber.length < 10) {
            return NextResponse.json(
                { error: 'Invalid phone number format' },
                { status: 400 }
            );
        }

        const preferenceData: any = {
            items: [
                {
                    id: booking.roomType.id,
                    title: `${booking.roomType.name} - ${checkInDate} a ${checkOutDate}`,
                    description: `Reserva #${booking.id.slice(0, 8)}`,
                    quantity: 1,
                    unit_price: Number(booking.totalPrice),
                    currency_id: 'BRL',
                },
            ],
            payer: {
                name: booking.guest.name,
                email: booking.guest.email,
                phone: {
                    area_code: phoneNumber.substring(0, 2),
                    number: phoneNumber.substring(2),
                },
            },
            back_urls: {
                success: `${baseUrl}/reservar/confirmacao/${booking.id}?status=approved`,
                failure: `${baseUrl}/reservar/confirmacao/${booking.id}?status=rejected`,
                pending: `${baseUrl}/reservar/confirmacao/${booking.id}?status=pending`,
            },
            // auto_return: 'approved', // Temporarily disabled to test
            external_reference: booking.id,
            notification_url: `${baseUrl}/api/webhooks/mercadopago`,
            statement_descriptor: 'POUSADA DELPLATA',
        };

        console.log('Base URL:', baseUrl);
        console.log('Creating preference with data:', JSON.stringify(preferenceData, null, 2));
        const result = await preference.create({ body: preferenceData });

        // Salvar ID da preferência no Payment
        await prisma.payment.create({
            data: {
                bookingId: booking.id,
                amount: booking.totalPrice,
                status: 'PENDING',
                provider: 'MERCADOPAGO',
                providerId: result.id || '',
            },
        });

        return NextResponse.json({
            preferenceId: result.id,
            initPoint: result.init_point,
            sandboxInitPoint: result.sandbox_init_point,
        });

    } catch (error: any) {
        console.error('Error creating preference:', error);
        return NextResponse.json(
            { error: 'Error creating payment preference', details: error.message },
            { status: 500 }
        );
    }
}
