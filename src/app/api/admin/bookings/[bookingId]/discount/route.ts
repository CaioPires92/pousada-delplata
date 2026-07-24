import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { sendGuestDiscountEmail } from '@/lib/email';
import {
    getCouponCodePrefix,
    hashCouponCode,
    normalizeGuestEmail,
    normalizeGuestPhone,
} from '@/lib/coupons/hash';
import { opsLog } from '@/lib/ops-log';
import { getDiscountPolicy } from '@/lib/discount-policy-store';

export const runtime = 'nodejs';

function generateCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let index = 0; index < 8; index += 1) {
        suffix += alphabet[randomInt(alphabet.length)];
    }
    return `VOLTE-${suffix}`;
}

function buildWhatsAppUrl(phone: string, guestName: string, code: string, bookingUrl: string, expiresAt: Date, percentage: number) {
    const normalizedPhone = normalizeGuestPhone(phone);
    if (!normalizedPhone) return null;
    const internationalPhone = normalizedPhone.startsWith('55') ? normalizedPhone : `55${normalizedPhone}`;
    const firstName = guestName.trim().split(/\s+/)[0] || 'tudo bem';
    const expiration = expiresAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const message = `Olá, ${firstName}! A Pousada Delplata preparou um cupom individual de ${percentage}% para sua próxima reserva: *${code}*. Válido até ${expiration}, para um uso. Reserve aqui: ${bookingUrl}`;
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

        const policy = await getDiscountPolicy();
        if (!policy.sendEnabled) {
            return NextResponse.json(
                { error: 'DISCOUNT_SENDING_PAUSED', message: 'O envio de novos descontos está pausado na política.' },
                { status: 409 }
            );
        }

        const code = generateCode();
        const expiresAt = new Date(Date.now() + policy.validityDays * 24 * 60 * 60 * 1000);
        const publicUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://www.pousadadelplata.com.br').replace(/\/+$/, '');
        const bookingUrl = `${publicUrl}/reservar?promo=${encodeURIComponent(code)}`;

        const coupon = await prisma.coupon.create({
            data: {
                name: `Retorno individual - ${booking.guest.name}`.slice(0, 120),
                codeHash: hashCouponCode(code),
                codePrefix: getCouponCodePrefix(code),
                type: 'PERCENT',
                value: policy.percentage,
                minBookingValue: policy.minimumBookingValue,
                maxDiscountAmount: policy.maximumDiscountAmount,
                active: true,
                startsAt: new Date(),
                endsAt: expiresAt,
                maxGlobalUses: 1,
                maxUsesPerGuest: 1,
                bindEmail: normalizeGuestEmail(booking.guest.email) || null,
                bindPhone: normalizeGuestPhone(booking.guest.phone) || null,
                originBookingId: booking.id,
                allowedRoomTypeIds: '[]',
                allowedSources: JSON.stringify(['direct']),
                singleUse: true,
                stackable: false,
            },
        });

        if (emailRequested) {
            const emailResult = await sendGuestDiscountEmail({
                guestName: booking.guest.name,
                guestEmail: booking.guest.email,
                code,
                discountPercent: policy.percentage,
                expiresAt,
                bookingUrl,
            });
            if (!emailResult.success) {
                await prisma.coupon.update({ where: { id: coupon.id }, data: { active: false } });
                return NextResponse.json(
                    { error: 'DISCOUNT_EMAIL_FAILED', message: 'O e-mail falhou e o cupom foi desativado por segurança.' },
                    { status: 502 }
                );
            }
        }

        const whatsappUrl = whatsappRequested
            ? buildWhatsAppUrl(booking.guest.phone, booking.guest.name, code, bookingUrl, expiresAt, policy.percentage)
            : null;

        opsLog('info', 'ADMIN_BOOKING_DISCOUNT_CREATED', {
            bookingId,
            adminId: auth.adminId,
            couponId: coupon.id,
            emailRequested,
            whatsappRequested,
        });

        return NextResponse.json({
            ok: true,
            code,
            discountPercent: policy.percentage,
            expiresAt: expiresAt.toISOString(),
            whatsappUrl,
        });
    } catch (error) {
        console.error('[Admin Booking Discount] Error:', error);
        return NextResponse.json(
            { error: 'DISCOUNT_CREATE_FAILED', message: 'Não foi possível criar o desconto.' },
            { status: 500 }
        );
    }
}
