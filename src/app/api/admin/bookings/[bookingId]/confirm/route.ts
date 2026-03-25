import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { opsLog } from '@/lib/ops-log';

export const runtime = 'nodejs';

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
        });

        if (!booking) {
            return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
        }

        const bookingStatus = String(booking.status || '').toUpperCase();
        if (bookingStatus === 'CONFIRMED') {
            return NextResponse.json({ ok: true, alreadyConfirmed: true, bookingId });
        }

        if (bookingStatus === 'CANCELLED' || bookingStatus === 'REFUNDED') {
            return NextResponse.json(
                {
                    error: 'BOOKING_NOT_CONFIRMABLE',
                    message: 'Reserva cancelada ou estornada nao pode ser confirmada.',
                },
                { status: 409 }
            );
        }

        await prisma.$transaction([
            prisma.booking.update({
                where: { id: bookingId },
                data: { status: 'CONFIRMED' },
            }),
            prisma.couponRedemption.updateMany({
                where: {
                    bookingId,
                    status: 'RESERVED',
                },
                data: {
                    status: 'CONFIRMED',
                    confirmedAt: new Date(),
                    bookingId,
                },
            }),
        ]);

        opsLog('info', 'ADMIN_BOOKING_CONFIRMED', {
            bookingId,
            adminId: auth.adminId,
            previousStatus: bookingStatus,
        });

        return NextResponse.json({ ok: true, bookingId, status: 'CONFIRMED' });
    } catch (error) {
        console.error('[Admin Booking Confirm] Error:', error);
        return NextResponse.json(
            {
                error: 'BOOKING_CONFIRM_FAILED',
                message: 'Nao foi possivel confirmar a reserva.',
            },
            { status: 500 }
        );
    }
}
