import { NextResponse } from 'next/server';
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
        const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

        console.log('[MP] Environment check:', {
            hasAccessToken: !!accessToken,
            hasPublicKey: !!publicKey,
            accessTokenLength: accessToken?.length || 0,
        });

        if (!accessToken) {
            console.error('[MP] MP_ACCESS_TOKEN not configured');
            return NextResponse.json(
                { error: 'Mercado Pago not configured - missing access token' },
                { status: 500 }
            );
        }

        if (!publicKey) {
            console.warn('[MP] NEXT_PUBLIC_MP_PUBLIC_KEY not configured (optional for Checkout Pro)');
        }

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

        // auto_return only works with public URLs (not localhost)
        // Enable it in production by checking if base URL is https
        const isProduction = baseUrl.startsWith('https://');

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
            ...(isProduction && { auto_return: 'approved' }), // Only in production
            external_reference: booking.id,
            notification_url: `${baseUrl}/api/webhooks/mercadopago`,
            statement_descriptor: 'POUSADA DELPLATA',
        };

        console.log('Base URL:', baseUrl);
        console.log('Creating preference with data:', JSON.stringify(preferenceData, null, 2));

        // Use direct API call instead of SDK - SDK has a bug with auto_return
        const apiResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(preferenceData),
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json().catch(() => ({ message: 'Unknown error' }));
            console.error('[MP] API error response:', {
                status: apiResponse.status,
                statusText: apiResponse.statusText,
                error: errorData,
            });

            return NextResponse.json(
                {
                    error: 'Failed to create payment preference',
                    details: errorData.message || `HTTP ${apiResponse.status}`,
                    mpError: errorData
                },
                { status: apiResponse.status }
            );
        }

        const result = await apiResponse.json();

        console.log('[MP] Preference created successfully:', {
            preferenceId: result.id,
            hasInitPoint: !!result.init_point,
            hasSandboxInitPoint: !!result.sandbox_init_point,
        });

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
