import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { sendGa4PurchaseServerEvent } from '@/lib/ga4-measurement';
import { opsLog } from '@/lib/ops-log';

export const runtime = 'nodejs';

function isTestPaymentsEnabled() {
    return String(process.env.ENABLE_TEST_PAYMENTS || '').trim().toLowerCase() === 'true';
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        if (!isTestPaymentsEnabled()) {
            return NextResponse.json(
                {
                    error: 'TEST_PAYMENTS_DISABLED',
                    message: 'Pagamento manual de teste desativado no servidor.',
                },
                { status: 403 }
            );
        }

        const { bookingId } = await params;
        if (!bookingId) {
            return NextResponse.json({ error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                payment: true,
                guest: true,
                roomType: true,
            },
        });

        if (!booking) {
            return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 });
        }

        const amount = Number(booking.totalPrice);
        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                {
                    error: 'INVALID_BOOKING_AMOUNT',
                    message: 'Reserva com valor invalido para teste.',
                },
                { status: 400 }
            );
        }

        const paymentStatus = String(booking.payment?.status || '').toUpperCase();
        const bookingStatus = String(booking.status || '').toUpperCase();
        if (paymentStatus === 'APPROVED' && bookingStatus === 'CONFIRMED') {
            return NextResponse.json({
                ok: true,
                alreadyApproved: true,
                bookingId,
            });
        }

        const testTransactionId = `TEST_${booking.id}_${Date.now()}`;

        await prisma.$transaction([
            prisma.payment.upsert({
                where: { bookingId: booking.id },
                update: {
                    amount,
                    status: 'APPROVED',
                    provider: 'MANUAL_TEST',
                    providerId: testTransactionId,
                    method: 'MANUAL_TEST',
                    cardBrand: null,
                    installments: null,
                },
                create: {
                    bookingId: booking.id,
                    amount,
                    status: 'APPROVED',
                    provider: 'MANUAL_TEST',
                    providerId: testTransactionId,
                    method: 'MANUAL_TEST',
                    cardBrand: null,
                    installments: null,
                },
            }),
            prisma.booking.update({
                where: { id: booking.id },
                data: { status: 'CONFIRMED' },
            }),
        ]);

        const ga4 = await sendGa4PurchaseServerEvent({
            transactionId: testTransactionId,
            value: amount,
            currency: 'BRL',
            itemId: booking.roomType?.id || booking.roomTypeId,
            itemName: booking.roomType?.name || 'Hospedagem',
            userId: booking.guest?.id || booking.guestId,
            source: 'manual_test_payment',
        });

        opsLog('info', 'ADMIN_TEST_PAYMENT_APPROVED', {
            bookingId: booking.id,
            testTransactionId,
            amount,
            adminId: auth.adminId,
            ga4Ok: ga4.ok,
            ga4Status: ga4.status,
            ga4Skipped: ga4.skipped,
            ga4Error: ga4.error,
        });

        return NextResponse.json({
            ok: true,
            bookingId: booking.id,
            transactionId: testTransactionId,
            bookingStatus: 'CONFIRMED',
            paymentStatus: 'APPROVED',
            ga4,
        });
    } catch (error) {
        console.error('[Admin Test Payment] Error:', error);
        return NextResponse.json(
            {
                error: 'TEST_PAYMENT_FAILED',
                message: 'Nao foi possivel aprovar pagamento de teste.',
            },
            { status: 500 }
        );
    }
}
