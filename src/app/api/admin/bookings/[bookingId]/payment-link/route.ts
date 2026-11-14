import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';
import { asNullableString } from '@/lib/requestValue';
import { signBookingAccessToken } from '@/lib/booking-access';
import { hasPaymentUnderReview } from '@/lib/mercadopago/payment-under-review';
import { buildPreferenceExpirationFields, getNewPaymentDeadline } from '@/lib/booking-payment-window';

export const runtime = 'nodejs';

function getPublicBaseUrl(request: Request) {
    const configured = (asNullableString(process.env.NEXT_PUBLIC_BASE_URL)
        ?? asNullableString(process.env.NEXT_PUBLIC_APP_URL)
        ?? '').replace(/\/+$/, '');

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
    const firstName = (asNullableString(params.guestName) ?? '').split(/\s+/)[0] || 'tudo bem';
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
        const normalizedBookingId = asNullableString(bookingId);
        if (!normalizedBookingId) {
            return NextResponse.json({ error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: normalizedBookingId },
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

        const accessToken = asNullableString(process.env.MP_ACCESS_TOKEN) ?? '';
        const publicBaseUrl = getPublicBaseUrl(request);
        if (!accessToken || !publicBaseUrl) {
            return NextResponse.json(
                { error: 'PAYMENT_CONFIGURATION_ERROR', message: 'A configuração do Mercado Pago está incompleta.' },
                { status: 500 }
            );
        }

        // Cartão em análise ainda pode ser aprovado: outro link permitiria cobrar duas vezes.
        if (await hasPaymentUnderReview(booking.id)) {
            return NextResponse.json(
                { error: 'PAYMENT_UNDER_REVIEW', message: 'Já existe um pagamento desta reserva em análise pelo Mercado Pago. Aguarde a conclusão antes de gerar outro link.' },
                { status: 409 }
            );
        }

        // Novo link = novo prazo: a reserva volta a segurar o quarto até o link vencer (+ folga).
        const paymentDeadline = getNewPaymentDeadline();
        const bookingAccessToken = await signBookingAccessToken(booking.id);
        const confirmationUrl = new URL(`/reservar/confirmacao/${booking.id}`, publicBaseUrl);
        if (bookingAccessToken) confirmationUrl.hash = new URLSearchParams({ access: bookingAccessToken }).toString();
        // O webhook valida o valor aprovado contra Payment.amount (pagamento parcial) ou o total.
        const amountDue = Number(Number(booking.payment?.amount ?? booking.totalPrice).toFixed(2));
        const stayNights = Math.max(1, Math.round(
            (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000
        ));
        const checkIn = booking.checkIn.toISOString().slice(0, 10);
        const checkOut = booking.checkOut.toISOString().slice(0, 10);
        // Sem `payer`: quem abre o link pode não ser o hóspede, e nome, e-mail e CPF enviados ao
        // Mercado Pago precisam ser da mesma pessoa. O pagador preenche os próprios dados.
        const preference = {
            items: [{
                id: booking.roomType.id,
                title: `Pousada Delplata - ${booking.roomType.name}`.slice(0, 120),
                description: `${stayNights} diária(s), ${checkIn} a ${checkOut}; ${booking.adults} adulto(s), ${booking.children} criança(s)${booking.pets > 0 ? `, ${booking.pets} pet(s)` : ''}`.slice(0, 256),
                quantity: 1,
                unit_price: amountDue,
                currency_id: 'BRL',
                category_id: 'travels',
                event_date: booking.checkIn.toISOString(),
            }],
            back_urls: {
                success: confirmationUrl.toString(),
                failure: confirmationUrl.toString(),
                pending: confirmationUrl.toString(),
            },
            auto_return: 'approved',
            external_reference: booking.id,
            notification_url: `${publicBaseUrl}/api/webhooks/mercadopago`,
            statement_descriptor: 'POUSADA DELPLATA',
            ...buildPreferenceExpirationFields(paymentDeadline),
            payment_methods: {
                excluded_payment_types: [{ id: 'ticket' }],
                installments: 12,
            },
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
                // Só códigos: a mensagem crua do MP pode ecoar dados do pagador.
                causeCodes: Array.isArray(result?.cause)
                    ? result.cause.map((cause: any) => String(cause?.code || '')).filter(Boolean)
                    : [],
            });
            return NextResponse.json(
                {
                    error: 'PAYMENT_LINK_CREATE_FAILED',
                    message: 'O Mercado Pago não conseguiu gerar o link.',
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
                paymentDeadlineAt: paymentDeadline,
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
