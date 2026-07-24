import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { sendBookingPendingEmail } from '@/lib/email';
import { opsLog } from '@/lib/ops-log';
import { hashCouponCode, normalizeCouponCode, normalizeGuestEmail, normalizeGuestPhone } from '@/lib/coupons/hash';

export const runtime = 'nodejs';

const DEFAULT_COOLDOWN_MINUTES = 30;

function getAssistEmailCooldownMs() {
    const raw = Number.parseInt(String(process.env.ADMIN_ASSIST_EMAIL_COOLDOWN_MINUTES || DEFAULT_COOLDOWN_MINUTES), 10);
    const minutes = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 24 * 60) : DEFAULT_COOLDOWN_MINUTES;
    return minutes * 60 * 1000;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { bookingId } = await params;
        const body = await request.json().catch(() => ({}));
        const emailRequested = Boolean(body?.channels?.email);
        const whatsappRequested = Boolean(body?.channels?.whatsapp);
        const couponCode = normalizeCouponCode(String(body?.couponCode || ''));
        if (!emailRequested && !whatsappRequested) {
            return NextResponse.json({ error: 'CHANNEL_REQUIRED', message: 'Selecione ao menos um canal.' }, { status: 400 });
        }
        if (!bookingId) {
            return NextResponse.json({ error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                guest: true,
                roomType: true,
                payment: true,
            },
        });

        if (!booking) {
            return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
        }
        if (emailRequested && !booking.guest.email) {
            return NextResponse.json({ error: 'GUEST_EMAIL_REQUIRED', message: 'A reserva não possui e-mail.' }, { status: 400 });
        }
        if (whatsappRequested && !booking.guest.phone) {
            return NextResponse.json({ error: 'GUEST_PHONE_REQUIRED', message: 'A reserva não possui WhatsApp.' }, { status: 400 });
        }

        const currentStatus = String(booking.status || '').toUpperCase();
        if (['CONFIRMED', 'PAID', 'COMPLETED'].includes(currentStatus)) {
            return NextResponse.json(
                {
                    error: 'BOOKING_ALREADY_CONFIRMED',
                    message: 'Email de ajuda não pode ser enviado para reservas já confirmadas ou concluídas.',
                },
                { status: 409 }
            );
        }

        const cooldownMs = getAssistEmailCooldownMs();
        if (emailRequested && booking.pendingEmailSentAt) {
            const lastSentAt = new Date(booking.pendingEmailSentAt).getTime();
            const elapsedMs = Date.now() - lastSentAt;
            if (Number.isFinite(lastSentAt) && elapsedMs >= 0 && elapsedMs < cooldownMs) {
                const remainingMs = cooldownMs - elapsedMs;
                const nextAllowedAt = new Date(lastSentAt + cooldownMs);
                return NextResponse.json(
                    {
                        error: 'ASSIST_EMAIL_COOLDOWN',
                        message: `Email de ajuda ja foi enviado recentemente. Aguarde ${Math.ceil(remainingMs / 60000)} minuto(s) para tentar novamente.`,
                        nextAllowedAt: nextAllowedAt.toISOString(),
                        remainingMinutes: Math.ceil(remainingMs / 60000),
                    },
                    { status: 429 }
                );
            }
        }

        const coupon = couponCode
            ? await prisma.coupon.findFirst({ where: { codeHash: hashCouponCode(couponCode) } })
            : null;
        const now = new Date();
        if (couponCode && !coupon) {
            return NextResponse.json({ error: 'COUPON_NOT_FOUND', message: 'Cupom não encontrado.' }, { status: 404 });
        }
        if (coupon && (!coupon.active || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now))) {
            return NextResponse.json({ error: 'COUPON_NOT_ACTIVE', message: 'Este cupom não está ativo.' }, { status: 409 });
        }
        if (coupon?.maxGlobalUses !== null && coupon?.maxGlobalUses !== undefined) {
            const confirmedUses = await prisma.couponRedemption.count({
                where: { couponId: coupon.id, status: 'CONFIRMED' },
            });
            if (confirmedUses >= coupon.maxGlobalUses) {
                return NextResponse.json({ error: 'COUPON_USAGE_LIMIT', message: 'Este cupom já atingiu o limite de usos.' }, { status: 409 });
            }
        }
        if (coupon?.bindEmail && normalizeGuestEmail(coupon.bindEmail) !== normalizeGuestEmail(booking.guest.email)) {
            return NextResponse.json({ error: 'COUPON_GUEST_MISMATCH', message: 'Este cupom pertence a outro hóspede.' }, { status: 409 });
        }
        if (coupon?.bindPhone && normalizeGuestPhone(coupon.bindPhone) !== normalizeGuestPhone(booking.guest.phone)) {
            return NextResponse.json({ error: 'COUPON_GUEST_MISMATCH', message: 'Este cupom pertence a outro hóspede.' }, { status: 409 });
        }
        const discountLabel = coupon
            ? (coupon.type === 'PERCENT'
                ? `${Number(coupon.value)}% de desconto`
                : `${Number(coupon.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto`)
            : '';
        const publicUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://www.pousadadelplata.com.br').replace(/\/+$/, '');
        const bookingQuery = new URLSearchParams({
            checkIn: booking.checkIn.toISOString().slice(0, 10),
            checkOut: booking.checkOut.toISOString().slice(0, 10),
            adults: String(booking.adults),
            children: String(booking.children),
        });
        if (couponCode) bookingQuery.set('promo', couponCode);
        const bookingUrl = `${publicUrl}/reservar?${bookingQuery.toString()}`;

        const emailResult = emailRequested ? await sendBookingPendingEmail({
            guestName: booking.guest.name,
            guestEmail: booking.guest.email,
            guestPhone: booking.guest.phone || null,
            bookingId: booking.id,
            roomName: booking.roomType.name,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            totalPrice: Number(booking.totalPrice),
            paymentMethod: booking.payment?.method || null,
            paymentInstallments: booking.payment?.installments ?? null,
            adults: booking.adults,
            children: booking.children,
            childrenAges: booking.childrenAges,
            bookingStatus: booking.status,
            paymentStatus: booking.payment?.status || null,
            bookingCreatedAt: booking.createdAt,
            recoveryCoupon: coupon && couponCode ? {
                code: couponCode,
                label: discountLabel,
                expiresAt: coupon.endsAt,
                bookingUrl,
            } : undefined,
        }) : { success: true };

        if (!emailResult?.success) {
            return NextResponse.json(
                {
                    error: 'ASSIST_EMAIL_SEND_FAILED',
                    message: 'Nao foi possivel enviar o email de ajuda para o hospede.',
                },
                { status: 502 }
            );
        }

        if (emailRequested) {
            await prisma.booking.update({
                where: { id: booking.id },
                data: { pendingEmailSentAt: new Date() },
            });
        }

        const normalizedPhone = normalizeGuestPhone(booking.guest.phone);
        const whatsappPhone = normalizedPhone.startsWith('55') ? normalizedPhone : `55${normalizedPhone}`;
        const couponMessage = couponCode
            ? ` Para ajudar você a concluir, podemos oferecer ${discountLabel} com o cupom *${couponCode}*.`
            : '';
        const whatsappMessage = `Olá, ${booking.guest.name.split(/\s+/)[0]}! Vimos que sua reserva na Pousada Delplata não foi concluída e estamos à disposição para ajudar.${couponMessage} Retome aqui: ${bookingUrl}`;
        const whatsappUrl = whatsappRequested
            ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`
            : null;

        opsLog('info', 'ADMIN_BOOKING_ASSIST_EMAIL_SENT', {
            bookingId: booking.id,
            adminId: auth.adminId,
            guestEmail: booking.guest.email,
            emailRequested,
            whatsappRequested,
            couponId: coupon?.id || null,
        });

        return NextResponse.json({
            ok: true,
            bookingId: booking.id,
            guestEmail: booking.guest.email,
            code: couponCode || null,
            whatsappUrl,
        });
    } catch (error) {
        console.error('[Admin Booking Assist Email] Error:', error);
        return NextResponse.json(
            {
                error: 'ASSIST_EMAIL_FAILED',
                message: 'Nao foi possivel processar o envio do email de ajuda.',
            },
            { status: 500 }
        );
    }
}
