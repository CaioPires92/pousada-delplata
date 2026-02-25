import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { sendBookingPendingEmail } from '@/lib/email';
import { opsLog } from '@/lib/ops-log';

export const runtime = 'nodejs';

const DEFAULT_COOLDOWN_MINUTES = 30;

function getAssistEmailCooldownMs() {
    const raw = Number.parseInt(String(process.env.ADMIN_ASSIST_EMAIL_COOLDOWN_MINUTES || DEFAULT_COOLDOWN_MINUTES), 10);
    const minutes = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 24 * 60) : DEFAULT_COOLDOWN_MINUTES;
    return minutes * 60 * 1000;
}

export async function POST(
    _request: Request,
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
            include: {
                guest: true,
                roomType: true,
                payment: true,
            },
        });

        if (!booking) {
            return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
        }

        if (String(booking.status || '').toUpperCase() !== 'PENDING') {
            return NextResponse.json(
                {
                    error: 'BOOKING_NOT_PENDING',
                    message: 'Email de ajuda so pode ser enviado para reserva pendente.',
                },
                { status: 409 }
            );
        }

        const cooldownMs = getAssistEmailCooldownMs();
        if (booking.pendingEmailSentAt) {
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

        const result = await sendBookingPendingEmail({
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
        });

        if (!result?.success) {
            return NextResponse.json(
                {
                    error: 'ASSIST_EMAIL_SEND_FAILED',
                    message: 'Nao foi possivel enviar o email de ajuda para o hospede.',
                },
                { status: 502 }
            );
        }

        await prisma.booking.update({
            where: { id: booking.id },
            data: { pendingEmailSentAt: new Date() },
        });

        opsLog('info', 'ADMIN_BOOKING_ASSIST_EMAIL_SENT', {
            bookingId: booking.id,
            adminId: auth.adminId,
            guestEmail: booking.guest.email,
        });

        return NextResponse.json({
            ok: true,
            bookingId: booking.id,
            guestEmail: booking.guest.email,
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
