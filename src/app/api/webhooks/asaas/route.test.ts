import { beforeEach, describe, expect, it, vi } from 'vitest';

import prisma from '@/lib/prisma';
import { sendBookingConfirmationEmail, sendBookingCreatedAlertEmail, sendDifficultyAlertEmail } from '@/lib/email';
import { hasRoomForBooking } from '@/lib/availability/room-check';
import { POST } from './route';

vi.mock('@/lib/email', () => ({
    sendBookingConfirmationEmail: vi.fn(async () => ({ success: true })),
    sendDifficultyAlertEmail: vi.fn(async () => ({ success: true })),
    sendBookingCreatedAlertEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/availability/room-check', () => ({
    hasRoomForBooking: vi.fn(async () => true),
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        payment: {
            findFirst: vi.fn(),
        },
        booking: {
            updateMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

const transactionClient = {
    booking: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    payment: {
        upsert: vi.fn(),
        updateMany: vi.fn(),
    },
    couponRedemption: {
        updateMany: vi.fn(),
    },
};

const booking = {
    id: 'booking-1',
    status: 'PENDING',
    totalPrice: 350,
    checkIn: new Date('2026-11-04T00:00:00.000Z'),
    checkOut: new Date('2026-11-05T00:00:00.000Z'),
    adults: 2,
    children: 0,
    childrenAges: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    confirmationEmailSentAt: null,
    guest: {
        name: 'Caio Pires',
        email: 'caio@example.com',
        phone: '5519999999999',
    },
    roomType: {
        name: 'Quarto Triplo',
    },
    payment: {
        amount: 350,
        remainingAmount: 0,
        paymentMode: 'FULL',
        balanceDueAt: null,
        balanceDueDate: null,
        status: 'PENDING',
    },
};

describe('POST /api/webhooks/asaas', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ASAAS_WEBHOOK_TOKEN = 'test-webhook-token-with-at-least-32-characters';
        (prisma.payment.findFirst as any).mockResolvedValue({ bookingId: booking.id });
        (prisma.$transaction as any).mockImplementation(async (callback: any) => callback(transactionClient));
        transactionClient.booking.findUnique.mockResolvedValue(booking);
        transactionClient.booking.update.mockResolvedValue({ ...booking, status: 'CONFIRMED' });
        transactionClient.payment.upsert.mockResolvedValue({ status: 'APPROVED' });
        transactionClient.couponRedemption.updateMany.mockResolvedValue({ count: 0 });
        (prisma.booking.updateMany as any).mockResolvedValue({ count: 1 });
    });

    it('reconciles a payment event through its checkout session', async () => {
        const response = await POST(new Request('https://example.com/api/webhooks/asaas', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN!,
            },
            body: JSON.stringify({
                id: 'evt-1',
                event: 'PAYMENT_CONFIRMED',
                payment: {
                    id: 'pay-1',
                    checkoutSession: 'checkout-1',
                    value: 350,
                    billingType: 'CREDIT_CARD',
                    status: 'CONFIRMED',
                },
            }),
        }));

        expect(response.status).toBe(200);
        expect(prisma.payment.findFirst).toHaveBeenCalledWith({
            where: { provider: 'ASAAS', providerId: { in: ['pay-1', 'checkout-1'] } },
            select: { bookingId: true },
        });
        expect(transactionClient.booking.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: booking.id },
            data: expect.objectContaining({ status: 'CONFIRMED' }),
        }));
        expect(transactionClient.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ status: 'APPROVED', providerId: 'pay-1' }),
        }));
    });

    const sendReversal = (event: string) => POST(new Request('https://example.com/api/webhooks/asaas', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN!,
        },
        body: JSON.stringify({
            id: 'evt-2',
            event,
            payment: { id: 'pay-1', externalReference: booking.id, value: 350, billingType: 'PIX' },
        }),
    }));

    it.each(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'])(
        'reverts an approved payment and cancels the confirmed booking on %s',
        async (event) => {
            transactionClient.booking.findUnique.mockResolvedValue({
                ...booking,
                status: 'CONFIRMED',
                payment: { ...booking.payment, status: 'APPROVED' },
            });
            transactionClient.payment.updateMany.mockResolvedValue({ count: 1 });

            const response = await sendReversal(event);

            expect(response.status).toBe(200);
            expect(transactionClient.payment.updateMany).toHaveBeenCalledWith({
                where: { bookingId: booking.id, status: 'APPROVED' },
                data: { status: 'REFUNDED' },
            });
            expect(transactionClient.booking.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: booking.id },
                data: expect.objectContaining({ status: 'CANCELLED', funnelStage: 'BOOKING_CANCELLED' }),
            }));
        },
    );

    it('does not cancel again when the refund event is redelivered', async () => {
        transactionClient.booking.findUnique.mockResolvedValue({
            ...booking,
            status: 'CANCELLED',
            payment: { ...booking.payment, status: 'REFUNDED' },
        });
        transactionClient.payment.updateMany.mockResolvedValue({ count: 0 });

        const response = await sendReversal('PAYMENT_REFUNDED');

        expect(response.status).toBe(200);
        expect(transactionClient.booking.update).not.toHaveBeenCalled();
    });

    function sendEvent(event: string, payment: Record<string, unknown> = {}) {
        return POST(new Request('https://example.com/api/webhooks/asaas', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN!,
            },
            body: JSON.stringify({
                event,
                payment: { id: 'pay_1', externalReference: booking.id, value: 350, billingType: 'CREDIT_CARD', ...payment },
            }),
        }));
    }

    it('marks the payment as under review during Asaas risk analysis', async () => {
        transactionClient.payment.updateMany.mockResolvedValue({ count: 1 });
        const response = await sendEvent('PAYMENT_AWAITING_RISK_ANALYSIS');
        expect(response.status).toBe(200);
        expect(transactionClient.payment.updateMany).toHaveBeenCalledWith({
            where: { bookingId: booking.id, status: { not: 'APPROVED' } },
            data: expect.objectContaining({ status: 'UNDER_REVIEW' }),
        });
        expect(transactionClient.booking.update).not.toHaveBeenCalled();
    });

    it('marks the payment as rejected when the risk analysis fails', async () => {
        transactionClient.payment.updateMany.mockResolvedValue({ count: 1 });
        await sendEvent('PAYMENT_REPROVED_BY_RISK_ANALYSIS');
        expect(transactionClient.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'REJECTED' }),
        }));
    });

    it('alerts the team once when payment is approved for an expired booking', async () => {
        transactionClient.booking.findUnique.mockResolvedValue({ ...booking, status: 'EXPIRED' });
        const response = await sendEvent('PAYMENT_CONFIRMED');
        expect(response.status).toBe(200);
        expect(transactionClient.booking.update).not.toHaveBeenCalled();
        expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
        expect(sendDifficultyAlertEmail).toHaveBeenCalledTimes(1);
        expect(vi.mocked(sendDifficultyAlertEmail).mock.calls[0][0]).toMatchObject({
            step: 'Pagamento aprovado sem confirmação da reserva',
        });
    });

    it('does not repeat the alert when the approval is redelivered', async () => {
        transactionClient.booking.findUnique.mockResolvedValue({
            ...booking, status: 'EXPIRED', payment: { ...booking.payment, status: 'APPROVED' },
        });
        await sendEvent('PAYMENT_RECEIVED');
        expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
    });

    const lateBooking = () => ({
        ...booking, createdAt: new Date(Date.now() - 3 * 60 * 60_000), paymentDeadlineAt: null,
    });

    it('confirms without checking availability while the room is still held (link expired, grace running)', async () => {
        transactionClient.booking.findUnique.mockResolvedValue({
            ...booking, createdAt: new Date(Date.now() - 90 * 60_000), paymentDeadlineAt: null,
        });
        await sendEvent('PAYMENT_CONFIRMED');
        expect(hasRoomForBooking).not.toHaveBeenCalled();
        expect(transactionClient.booking.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'CONFIRMED' }),
        }));
        expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
    });

    it('confirms a late payment when the room is still available', async () => {
        transactionClient.booking.findUnique.mockResolvedValue(lateBooking());
        vi.mocked(hasRoomForBooking).mockResolvedValueOnce(true);
        await sendEvent('PAYMENT_CONFIRMED');
        expect(transactionClient.booking.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'CONFIRMED' }),
        }));
        expect(sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
        expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
    });

    it('does not confirm a late payment when the room was taken, and alerts the team', async () => {
        transactionClient.booking.findUnique.mockResolvedValue(lateBooking());
        vi.mocked(hasRoomForBooking).mockResolvedValueOnce(false);
        const response = await sendEvent('PAYMENT_CONFIRMED');
        expect(response.status).toBe(200);
        expect(transactionClient.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ status: 'APPROVED' }),
        }));
        expect(transactionClient.booking.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'EXPIRED', funnelStage: 'PAID_WITHOUT_AVAILABILITY' }),
        }));
        expect(transactionClient.booking.update).not.toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'CONFIRMED' }),
        }));
        expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
        expect(sendDifficultyAlertEmail).toHaveBeenCalledWith(expect.objectContaining({
            step: 'Pagamento recebido sem quarto disponível',
        }));
    });

    it('does not check availability for a payment inside the deadline', async () => {
        transactionClient.booking.findUnique.mockResolvedValue({
            ...booking, createdAt: new Date(Date.now() - 10 * 60_000), paymentDeadlineAt: null,
        });
        await sendEvent('PAYMENT_CONFIRMED');
        expect(hasRoomForBooking).not.toHaveBeenCalled();
        expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
    });

    it('notifies the team only once the booking is confirmed', async () => {
        await sendEvent('PAYMENT_CONFIRMED');
        expect(sendBookingCreatedAlertEmail).toHaveBeenCalledTimes(1);
        expect(vi.mocked(sendBookingCreatedAlertEmail).mock.calls[0][0]).toMatchObject({
            bookingId: booking.id, bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED',
        });
    });

    it('does not notify the team again when the approval is redelivered', async () => {
        transactionClient.booking.findUnique.mockResolvedValue({
            ...booking, status: 'CONFIRMED', payment: { ...booking.payment, status: 'APPROVED' },
        });
        await sendEvent('PAYMENT_RECEIVED');
        expect(sendBookingCreatedAlertEmail).not.toHaveBeenCalled();
    });

    it('includes the pets in the guest confirmation email', async () => {
        transactionClient.booking.findUnique.mockResolvedValue({
            ...booking, pets: 2, createdAt: new Date(Date.now() - 10 * 60_000), paymentDeadlineAt: null,
        });
        await sendEvent('PAYMENT_CONFIRMED');
        expect(vi.mocked(sendBookingConfirmationEmail).mock.calls[0][0]).toMatchObject({ pets: 2, paymentMethod: 'CREDIT_CARD' });
    });

    it('confirms a late payment without checking availability while the card was under review', async () => {
        transactionClient.booking.findUnique.mockResolvedValue({
            ...booking,
            createdAt: new Date(Date.now() - 6 * 60 * 60_000),
            paymentDeadlineAt: null,
            payment: { ...booking.payment, status: 'UNDER_REVIEW', updatedAt: new Date(Date.now() - 60 * 60_000) },
        });
        await sendEvent('PAYMENT_CONFIRMED');
        expect(hasRoomForBooking).not.toHaveBeenCalled();
        expect(transactionClient.booking.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'CONFIRMED' }),
        }));
    });

    it('rejects requests with a wrong token', async () => {
        const response = await POST(new Request('https://example.com/api/webhooks/asaas', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'asaas-access-token': 'wrong-token' },
            body: JSON.stringify({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1', externalReference: booking.id, value: 350 } }),
        }));
        expect(response.status).toBe(401);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to confirm when the paid amount differs from the expected amount', async () => {
        const response = await sendEvent('PAYMENT_CONFIRMED', { value: 10 });
        expect(response.status).toBe(422);
        expect(transactionClient.payment.upsert).not.toHaveBeenCalled();
        expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
    });

    describe('cartao parcelado (um PAYMENT_CONFIRMED por parcela)', () => {
        it('aceita a parcela com valor compativel e confirma a reserva', async () => {
            const response = await sendEvent('PAYMENT_CONFIRMED', { value: 116.67, installmentNumber: 1 });
            expect(response.status).toBe(200);
            expect(transactionClient.booking.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'CONFIRMED' }),
            }));
            // 350 / 116,67 = 3 parcelas (e nao "1x", que e o numero da parcela).
            expect(vi.mocked(sendBookingConfirmationEmail).mock.calls[0][0]).toMatchObject({ paymentInstallments: 3 });
        });

        it('recusa parcela com valor incompativel (422) e nao envia e-mail', async () => {
            const response = await sendEvent('PAYMENT_CONFIRMED', { value: 1, installmentNumber: 2 });
            expect(response.status).toBe(422);
            expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
            expect(sendBookingCreatedAlertEmail).not.toHaveBeenCalled();
        });

        it('sem installmentNumber continua exigindo o valor exato', async () => {
            const response = await sendEvent('PAYMENT_CONFIRMED', { value: 116.67 });
            expect(response.status).toBe(422);
        });

        it('reentrega das parcelas seguintes nao confirma nem envia e-mail de novo', async () => {
            transactionClient.booking.findUnique.mockResolvedValue({
                ...booking, status: 'CONFIRMED', payment: { ...booking.payment, status: 'APPROVED' },
            });
            const response = await sendEvent('PAYMENT_CONFIRMED', { value: 116.67, installmentNumber: 2 });
            expect(response.status).toBe(200);
            expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
            expect(sendBookingCreatedAlertEmail).not.toHaveBeenCalled();
        });
    });
});
