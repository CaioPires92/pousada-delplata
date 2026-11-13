import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { authorizeBookingRequest } from '@/lib/booking-access';
import { sendBookingGuestConfirmationEmail } from '@/lib/booking-status-alert';
import { opsLog } from '@/lib/ops-log';
import { consumeRequestLimit, readJsonBody, RequestGuardError } from '@/lib/request-guard';

export const runtime = 'nodejs';

const CONFIRMATION_RESEND_COOLDOWN_MS = 15 * 60_000;
const ALLOWED_BODY_FIELDS = new Set(['bookingId']);

export async function POST(request: Request) {
    let bookingId = '';

    try {
        const body = await readJsonBody<Record<string, unknown>>(request, 2 * 1024);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
        }
        if (Object.keys(body).some((field) => !ALLOWED_BODY_FIELDS.has(field))) {
            return NextResponse.json({ error: 'UNSUPPORTED_EMAIL_FIELDS' }, { status: 400 });
        }

        bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
        if (!bookingId || bookingId.length > 128) {
            return NextResponse.json({ error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
        }

        const access = await authorizeBookingRequest(request, bookingId);
        if (!access.authorized) {
            return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
        }

        const rateLimit = consumeRequestLimit({
            request,
            scope: 'booking-confirmation-email',
            discriminator: bookingId,
            limit: 5,
            windowMs: 60 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'TOO_MANY_EMAIL_REQUESTS' }, {
                status: 429,
                headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
            });
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
        if (String(booking.status || '').toUpperCase() !== 'CONFIRMED') {
            return NextResponse.json({ error: 'BOOKING_NOT_CONFIRMED' }, { status: 409 });
        }

        const claimedAt = new Date();
        const cooldownCutoff = new Date(claimedAt.getTime() - CONFIRMATION_RESEND_COOLDOWN_MS);
        const previousSentAt = booking.confirmationEmailSentAt
            ? new Date(booking.confirmationEmailSentAt)
            : null;
        const claim = await prisma.booking.updateMany({
            where: {
                id: booking.id,
                status: booking.status,
                OR: [
                    { confirmationEmailSentAt: null },
                    { confirmationEmailSentAt: { lte: cooldownCutoff } },
                ],
            },
            data: { confirmationEmailSentAt: claimedAt },
        });
        if (claim.count !== 1) {
            return NextResponse.json({ error: 'CONFIRMATION_EMAIL_COOLDOWN' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil(CONFIRMATION_RESEND_COOLDOWN_MS / 1_000)) },
            });
        }

        let emailResult: Awaited<ReturnType<typeof sendBookingGuestConfirmationEmail>>;
        try {
            emailResult = await sendBookingGuestConfirmationEmail(booking, {
                bookingStatus: 'CONFIRMED',
                paymentStatus: booking.payment?.status || 'APPROVED',
            });
        } catch {
            emailResult = { success: false, error: 'EMAIL_SEND_FAILED' };
        }

        if (!emailResult?.success) {
            await prisma.booking.updateMany({
                where: {
                    id: booking.id,
                    confirmationEmailSentAt: claimedAt,
                },
                data: { confirmationEmailSentAt: previousSentAt },
            });
            opsLog('error', 'BOOKING_CONFIRMATION_EMAIL_FAILED', {
                bookingIdShort: booking.id.slice(0, 8),
            });
            return NextResponse.json(
                { error: 'BOOKING_CONFIRMATION_EMAIL_FAILED' },
                { status: 502 }
            );
        }

        opsLog('info', 'BOOKING_CONFIRMATION_EMAIL_SENT', {
            bookingIdShort: booking.id.slice(0, 8),
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof RequestGuardError) {
            return NextResponse.json({ error: error.code }, { status: error.status });
        }
        opsLog('error', 'BOOKING_CONFIRMATION_EMAIL_UNEXPECTED_ERROR', {
            ...(bookingId ? { bookingIdShort: bookingId.slice(0, 8) } : {}),
        });
        return NextResponse.json(
            { error: 'BOOKING_CONFIRMATION_EMAIL_FAILED' },
            { status: 500 }
        );
    }
}
