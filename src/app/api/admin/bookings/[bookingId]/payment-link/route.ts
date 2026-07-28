import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';

export const runtime = 'nodejs';

function getPublicBaseUrl(request: Request) {
    const configured = String(
        process.env.NEXT_PUBLIC_BASE_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || ''
    ).trim().replace(/\/+$/, '');

    if (configured.startsWith('https://') || configured.startsWith('http://localhost')) {
        return configured;
    }

    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = forwardedHost || request.headers.get('host') || '';
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    return host ? `${protocol}://${host}` : '';
}

function buildWhatsAppUrl(params: {
    phone: string;
    guestName: string;
    paymentLink: string;
    checkIn: Date;
    checkOut: Date;
}) {
    const digits = String(params.phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const normalizedPhone = digits.startsWith('55') ? digits : `55${digits}`;
    const firstName = String(params.guestName || '').trim().split(/\s+/)[0] || 'tudo bem';
    const formatDate = (date: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
    const message = [
        `Olá, ${firstName}! Tudo bem?`,
        'Criamos um novo link para o pagamento da sua reserva na Pousada Delplata:',
        params.paymentLink,
        `Check-in: ${formatDate(params.checkIn)} | Check-out: ${formatDate(params.checkOut)}.`,
        'Se precisar de ajuda, estamos à disposição.',
    ].join('\n\n');
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { bookingId } = await params;
        if (!bookingId) {
            return NextResponse.json({ error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { roomType: true, guest: true, payment: true },
        });
        if (!booking) {
            return NextResponse.json({ error: 'BOOKING_NOT_FOUND', message: 'Reserva não encontrada.' }, { status: 404 });
        }

        const bookingStatus = String(booking.status || '').toUpperCase();
        const paymentStatus = String(booking.payment?.status || '').toUpperCase();
        if (paymentStatus === 'APPROVED' || ['CONFIRMED', 'PAID', 'COMPLETED'].includes(bookingStatus)) {
            return NextResponse.json(
                { error: 'BOOKING_ALREADY_PAID', message: 'Esta reserva já possui pagamento aprovado.' },
                { status: 409 }
            );
        }
        if (['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(bookingStatus)) {
            return NextResponse.json(
                { error: 'BOOKING_NOT_PAYABLE', message: 'Não é possível gerar pagamento para uma reserva cancelada, expirada ou estornada.' },
                { status: 409 }
            );
        }

        const accessToken = String(process.env.MP_ACCESS_TOKEN || '').trim();
        const publicBaseUrl = getPublicBaseUrl(request);
        if (!accessToken || !publicBaseUrl) {
            return NextResponse.json(
                { error: 'PAYMENT_CONFIGURATION_ERROR', message: 'A configuração do Mercado Pago está incompleta.' },
                { status: 500 }
            );
        }

        const phone = String(booking.guest.phone || '').replace(/\D/g, '');
        const confirmationUrl = `${publicBaseUrl}/reservar/confirmacao/${booking.id}`;
        const preference = {
            items: [{
                id: booking.roomType.id,
                title: `Pousada Delplata - ${booking.roomType.name}`,
                quantity: 1,
                unit_price: Number(Number(booking.totalPrice).toFixed(2)),
                currency_id: 'BRL',
            }],
            payer: {
                name: booking.guest.name,
                email: booking.guest.email,
                ...(phone ? {
                    phone: {
                        area_code: phone.slice(0, 2),
                        number: phone.slice(2),
                    },
                } : {}),
            },
            back_urls: {
                success: confirmationUrl,
                failure: confirmationUrl,
                pending: confirmationUrl,
            },
            auto_return: 'approved',
            external_reference: booking.id,
            notification_url: `${publicBaseUrl}/api/webhooks/mercadopago`,
        };

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'X-Idempotency-Key': `admin-payment-link-${booking.id}-${Date.now()}`,
            },
            body: JSON.stringify(preference),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.init_point) {
            opsLog('error', 'ADMIN_PAYMENT_LINK_CREATE_FAILED', {
                bookingId: booking.id,
                adminId: auth.adminId,
                status: response.status,
                error: result?.error,
                message: result?.message,
            });
            return NextResponse.json(
                {
                    error: 'PAYMENT_LINK_CREATE_FAILED',
                    message: result?.message || 'O Mercado Pago não conseguiu gerar o link.',
                },
                { status: response.ok ? 502 : response.status }
            );
        }

        await prisma.booking.update({
            where: { id: booking.id },
            data: {
                funnelStage: 'PAYMENT_LINK_CREATED',
                funnelUpdatedAt: new Date(),
                lastErrorMessage: null,
            },
        });

        const paymentLink = String(result.init_point);
        const whatsappUrl = buildWhatsAppUrl({
            phone: booking.guest.phone,
            guestName: booking.guest.name,
            paymentLink,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
        });

        opsLog('info', 'ADMIN_PAYMENT_LINK_CREATED', {
            bookingId: booking.id,
            adminId: auth.adminId,
            preferenceId: result.id,
        });

        return NextResponse.json({
            success: true,
            paymentLink,
            preferenceId: result.id,
            whatsappUrl,
        });
    } catch (error) {
        opsLog('error', 'ADMIN_PAYMENT_LINK_UNEXPECTED_ERROR', {
            message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: 'PAYMENT_LINK_UNEXPECTED_ERROR', message: 'Não foi possível gerar o link de pagamento.' },
            { status: 500 }
        );
    }
}
