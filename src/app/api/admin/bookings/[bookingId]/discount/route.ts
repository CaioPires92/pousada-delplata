import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { sendGuestDiscountEmail } from '@/lib/email';
import {
    hashCouponCode,
    normalizeCouponCode,
    normalizeGuestEmail,
    normalizeGuestPhone,
} from '@/lib/coupons/hash';
import { opsLog } from '@/lib/ops-log';

export const runtime = 'nodejs';

function getCouponLabel(type: string, value: unknown) {
    const amount = Number(value);
    if (type === 'PERCENT') return `${amount}% de desconto`;
    return `${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto`;
}

function buildWhatsAppUrl(
    phone: string,
    guestName: string,
    bookingUrl: string,
    coupon?: { code: string; label: string; expiresAt: Date | null }
) {
    const normalizedPhone = normalizeGuestPhone(phone);
    if (!normalizedPhone) return null;
    const internationalPhone = normalizedPhone.startsWith('55') ? normalizedPhone : `55${normalizedPhone}`;
    const firstName = guestName.trim().split(/\s+/)[0] || 'tudo bem';
    const couponText = coupon
        ? ` Para deixar o convite ainda melhor, use o cupom *${coupon.code}* (${coupon.label})${coupon.expiresAt ? `, válido até ${coupon.expiresAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}. O desconto é exclusivo para reservas pelo site oficial.`
        : '';
    const message = `Olá, ${firstName}! Gostaríamos de receber você novamente na Pousada Delplata.${couponText} Planeje sua próxima estadia aqui: ${bookingUrl}`;
    return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
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

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { guest: true },
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

        const coupon = couponCode
            ? await prisma.coupon.findFirst({
                where: { codeHash: hashCouponCode(couponCode) },
            })
            : null;
        const now = new Date();
        if (couponCode && !coupon) {
            return NextResponse.json({ error: 'COUPON_NOT_FOUND', message: 'Cupom não encontrado.' }, { status: 404 });
        }
        const confirmedUses = coupon?.maxGlobalUses !== null && coupon?.maxGlobalUses !== undefined
            ? await prisma.couponRedemption.count({ where: { couponId: coupon.id, status: 'CONFIRMED' } })
            : 0;
        if (coupon && (
            !coupon.active ||
            (coupon.startsAt && coupon.startsAt > now) ||
            (coupon.endsAt && coupon.endsAt < now) ||
            (coupon.maxGlobalUses !== null && confirmedUses >= coupon.maxGlobalUses)
        )) {
            return NextResponse.json({ error: 'COUPON_NOT_ACTIVE', message: 'Este cupom não está ativo ou já atingiu o limite de usos.' }, { status: 409 });
        }
        const guestEmail = normalizeGuestEmail(booking.guest.email);
        const guestPhone = normalizeGuestPhone(booking.guest.phone);
        if (coupon?.bindEmail && normalizeGuestEmail(coupon.bindEmail) !== guestEmail) {
            return NextResponse.json({ error: 'COUPON_GUEST_MISMATCH', message: 'Este cupom pertence a outro hóspede.' }, { status: 409 });
        }
        if (coupon?.bindPhone && normalizeGuestPhone(coupon.bindPhone) !== guestPhone) {
            return NextResponse.json({ error: 'COUPON_GUEST_MISMATCH', message: 'Este cupom pertence a outro hóspede.' }, { status: 409 });
        }

        const publicUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://www.pousadadelplata.com.br').replace(/\/+$/, '');
        const bookingUrl = couponCode
            ? `${publicUrl}/reservar?promo=${encodeURIComponent(couponCode)}`
            : `${publicUrl}/reservar`;
        const discountLabel = coupon ? getCouponLabel(coupon.type, coupon.value) : undefined;

        if (emailRequested) {
            const emailResult = await sendGuestDiscountEmail({
                guestName: booking.guest.name,
                guestEmail: booking.guest.email,
                code: couponCode || undefined,
                discountLabel,
                expiresAt: coupon?.endsAt,
                bookingUrl,
            });
            if (!emailResult.success) {
                return NextResponse.json(
                    { error: 'RETURN_INVITE_EMAIL_FAILED', message: 'Não foi possível enviar o convite por e-mail.' },
                    { status: 502 }
                );
            }
        }

        const whatsappUrl = whatsappRequested
            ? buildWhatsAppUrl(
                booking.guest.phone,
                booking.guest.name,
                bookingUrl,
                coupon && couponCode ? { code: couponCode, label: discountLabel || '', expiresAt: coupon.endsAt } : undefined
            )
            : null;

        opsLog('info', 'ADMIN_BOOKING_RETURN_INVITE_SENT', {
            bookingId,
            adminId: auth.adminId,
            couponId: coupon?.id || null,
            emailRequested,
            whatsappRequested,
        });

        return NextResponse.json({
            ok: true,
            code: couponCode || null,
            discountLabel: discountLabel || null,
            expiresAt: coupon?.endsAt?.toISOString() || null,
            whatsappUrl,
        });
    } catch (error) {
        console.error('[Admin Booking Return Invite] Error:', error);
        return NextResponse.json(
            { error: 'RETURN_INVITE_FAILED', message: 'Não foi possível enviar o convite.' },
            { status: 500 }
        );
    }
}
