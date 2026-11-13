import { NextResponse } from 'next/server';
import { sendBookingConfirmationEmail } from '@/lib/email';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { consumeRequestLimit, readJsonBody, RequestGuardError } from '@/lib/request-guard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
        }

        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await readJsonBody<Record<string, unknown>>(request, 2 * 1024);
        const bookingId = typeof body?.bookingId === 'string' ? body.bookingId.trim() : '';

        if (!bookingId || bookingId.length > 128 || Object.keys(body).some((key) => key !== 'bookingId')) {
            return NextResponse.json(
                { error: 'INVALID_REQUEST' },
                { status: 400 }
            );
        }

        const rateLimit = consumeRequestLimit({
            request,
            scope: 'admin-test-email',
            discriminator: `${auth.adminId}:${bookingId}`,
            limit: 3,
            windowMs: 15 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'TOO_MANY_EMAIL_REQUESTS' }, {
                status: 429,
                headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
            });
        }

        // Buscar a reserva
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                guest: true,
                roomType: true,
                payment: true,
            },
        });

        if (!booking) {
            return NextResponse.json(
                { error: 'Reserva não encontrada' },
                { status: 404 }
            );
        }

        // Enviar email de teste
        const result = await sendBookingConfirmationEmail({
            guestName: booking.guest.name,
            guestEmail: booking.guest.email,
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
        });

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { error: 'EMAIL_SEND_FAILED' },
                { status: 502 }
            );
        }
    } catch (error) {
        if (error instanceof RequestGuardError) {
            return NextResponse.json({ error: error.code }, { status: error.status });
        }
        console.error('Falha na rota administrativa de teste de email.');
        return NextResponse.json(
            { error: 'EMAIL_SEND_FAILED' },
            { status: 500 }
        );
    }
}
