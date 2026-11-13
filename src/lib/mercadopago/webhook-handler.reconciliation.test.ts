import { beforeEach, describe, expect, it, vi } from 'vitest';

import prisma from '@/lib/prisma';
import {
    sendBookingConfirmationEmail,
    sendBookingCreatedAlertEmail,
    sendDifficultyAlertEmail,
} from '@/lib/email';
import { hasRoomForBooking } from '@/lib/availability/room-check';
import { handleMercadoPagoWebhook } from './webhook-handler';

vi.mock('@/lib/prisma', () => {
    const client: any = {
        booking: { findUnique: vi.fn(), updateMany: vi.fn() },
        payment: { updateMany: vi.fn(), create: vi.fn() },
        couponRedemption: { updateMany: vi.fn() },
        paymentAttempt: { findUnique: vi.fn(), upsert: vi.fn(), count: vi.fn() },
        $transaction: vi.fn(),
    };
    client.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(client));
    return { default: client };
});

vi.mock('@/lib/email', () => ({
    sendBookingConfirmationEmail: vi.fn(),
    sendBookingCreatedAlertEmail: vi.fn(),
    sendDifficultyAlertEmail: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock('@/lib/ops-log', () => ({ opsLog: vi.fn() }));
vi.mock('@/lib/availability/room-check', () => ({ hasRoomForBooking: vi.fn(async () => true) }));
vi.mock('@/lib/ga4-measurement', () => ({
    sendGa4PurchaseServerEvent: vi.fn().mockResolvedValue({ ok: true }),
}));

const db = prisma as any;

const PRIMARY_PAYMENT_ID = '1001';
const DUPLICATE_PAYMENT_ID = '2002';

function bookingFixture(overrides: {
    status?: string;
    createdAt?: Date;
    payment?: Record<string, unknown> | null;
} = {}) {
    return {
        id: 'booking-1',
        status: overrides.status ?? 'PENDING',
        totalPrice: 1000,
        subtotalPrice: 1000,
        discountAmount: 0,
        appliedCouponCode: null,
        adults: 2,
        children: 0,
        childrenAges: null,
        pets: 0,
        checkIn: new Date('2026-12-20T00:00:00.000Z'),
        checkOut: new Date('2026-12-22T00:00:00.000Z'),
        createdAt: overrides.createdAt ?? new Date(Date.now() - 5 * 60_000),
        paymentDeadlineAt: null,
        roomTypeId: 'room-1',
        guestId: 'guest-1',
        guest: { id: 'guest-1', name: 'Hóspede Teste', email: 'hospede@example.test', phone: null },
        roomType: { id: 'room-1', name: 'Quarto Teste' },
        couponRedemption: null,
        payment: overrides.payment === undefined
            ? {
                id: 'payment-row-1',
                amount: 1000,
                status: 'PENDING',
                providerId: null,
                method: null,
                cardBrand: null,
                installments: null,
                paymentMode: 'FULL',
                remainingAmount: 0,
                balanceDueAt: null,
                balanceDueDate: null,
            }
            : overrides.payment,
    };
}

function approvedPaymentRow(providerId = PRIMARY_PAYMENT_ID) {
    return {
        id: 'payment-row-1',
        amount: 1000,
        status: 'APPROVED',
        providerId,
        method: 'CREDIT_CARD',
        cardBrand: 'VISA',
        installments: 1,
        paymentMode: 'FULL',
        remainingAmount: 0,
        balanceDueAt: null,
        balanceDueDate: null,
    };
}

function mockMercadoPagoPayment(id: string, status: string, extra: Record<string, unknown> = {}) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
            id,
            status,
            status_detail: extra.status_detail ?? status,
            external_reference: 'booking-1',
            transaction_amount: 1000,
            currency_id: 'BRL',
            payment_method_id: extra.payment_method_id ?? 'visa',
            payment_type_id: extra.payment_type_id ?? 'credit_card',
            installments: 1,
        }),
    }));
}

function webhookRequest(paymentId: string) {
    return new Request(`https://example.test/api/webhooks/mercadopago?data.id=${paymentId}&type=payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'payment', data: { id: paymentId } }),
    });
}

function bookingUpdatesTo(status: string) {
    return db.booking.updateMany.mock.calls.filter(([args]: any[]) => args?.data?.status === status);
}

function paymentUpdatesWithProvider(providerId: string) {
    return db.payment.updateMany.mock.calls.filter(([args]: any[]) => args?.data?.providerId === providerId);
}

describe('Mercado Pago webhook reconciliation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.MP_WEBHOOK_SECRET;
        process.env.MP_ACCESS_TOKEN = 'TEST-token';
        db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
        db.booking.updateMany.mockResolvedValue({ count: 1 });
        db.payment.updateMany.mockResolvedValue({ count: 1 });
        db.couponRedemption.updateMany.mockResolvedValue({ count: 0 });
        db.paymentAttempt.findUnique.mockResolvedValue(null);
        db.paymentAttempt.upsert.mockResolvedValue({});
        db.paymentAttempt.count.mockResolvedValue(0);
        vi.mocked(sendBookingConfirmationEmail).mockResolvedValue({ success: true } as any);
        vi.mocked(sendBookingCreatedAlertEmail).mockResolvedValue({ success: true } as any);
        vi.mocked(sendDifficultyAlertEmail).mockResolvedValue({ success: true } as any);
    });

    it('confirms a pending booking on its first approved payment', async () => {
        db.booking.findUnique.mockResolvedValue(bookingFixture());
        mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'approved');

        const response = await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED' });
        expect(bookingUpdatesTo('CONFIRMED')).toHaveLength(1);
        expect(paymentUpdatesWithProvider(PRIMARY_PAYMENT_ID)).toHaveLength(1);
        expect(sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
        expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
    });

    it('does not resend email or alerts when the same approval is redelivered', async () => {
        db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'CONFIRMED', payment: approvedPaymentRow() }));
        db.paymentAttempt.findUnique.mockResolvedValue({ status: 'APPROVED' });
        mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'approved');

        await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));

        expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
        expect(sendBookingCreatedAlertEmail).not.toHaveBeenCalled();
        expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
    });

    describe('second approved payment for an already paid booking', () => {
        it('keeps the first payment id and alerts the team about the duplicate', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'CONFIRMED', payment: approvedPaymentRow() }));
            mockMercadoPagoPayment(DUPLICATE_PAYMENT_ID, 'approved');

            const response = await handleMercadoPagoWebhook(webhookRequest(DUPLICATE_PAYMENT_ID));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toMatchObject({ status: 'duplicate_payment', primaryPaymentId: PRIMARY_PAYMENT_ID });
            expect(paymentUpdatesWithProvider(DUPLICATE_PAYMENT_ID)).toHaveLength(0);
            expect(db.booking.updateMany).not.toHaveBeenCalled();
            expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
            expect(sendDifficultyAlertEmail).toHaveBeenCalledTimes(1);
            expect(vi.mocked(sendDifficultyAlertEmail).mock.calls[0][0]).toMatchObject({
                bookingId: 'booking-1',
                paymentProviderId: DUPLICATE_PAYMENT_ID,
            });
            expect(db.paymentAttempt.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { providerPaymentId: DUPLICATE_PAYMENT_ID },
            }));
        });

        it('does not repeat the duplicate alert on redelivery', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'CONFIRMED', payment: approvedPaymentRow() }));
            db.paymentAttempt.findUnique.mockResolvedValue({ status: 'APPROVED' });
            mockMercadoPagoPayment(DUPLICATE_PAYMENT_ID, 'approved');

            await handleMercadoPagoWebhook(webhookRequest(DUPLICATE_PAYMENT_ID));

            expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
        });

        it('ignores a pending event from another payment without touching the paid booking', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'CONFIRMED', payment: approvedPaymentRow() }));
            mockMercadoPagoPayment(DUPLICATE_PAYMENT_ID, 'in_process');

            await handleMercadoPagoWebhook(webhookRequest(DUPLICATE_PAYMENT_ID));

            expect(db.payment.updateMany).not.toHaveBeenCalled();
            expect(db.booking.updateMany).not.toHaveBeenCalled();
        });
    });

    describe('refund of a duplicate payment', () => {
        it('keeps the valid booking confirmed', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'CONFIRMED', payment: approvedPaymentRow() }));
            mockMercadoPagoPayment(DUPLICATE_PAYMENT_ID, 'refunded');

            const response = await handleMercadoPagoWebhook(webhookRequest(DUPLICATE_PAYMENT_ID));
            const body = await response.json();

            expect(body).toMatchObject({ bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED' });
            expect(bookingUpdatesTo('CANCELLED')).toHaveLength(0);
            expect(db.payment.updateMany).not.toHaveBeenCalled();
            expect(db.couponRedemption.updateMany).not.toHaveBeenCalled();
            expect(sendBookingCreatedAlertEmail).not.toHaveBeenCalled();
        });

        it('still cancels the booking when the primary payment is refunded', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'CONFIRMED', payment: approvedPaymentRow() }));
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'refunded');

            const response = await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));
            const body = await response.json();

            expect(body).toMatchObject({ bookingStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
            expect(bookingUpdatesTo('CANCELLED')).toHaveLength(1);
            expect(sendBookingCreatedAlertEmail).toHaveBeenCalledTimes(1);
        });

        it('does not repeat the refund alert on redelivery', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({
                status: 'CANCELLED',
                payment: { ...approvedPaymentRow(), status: 'REFUNDED' },
            }));
            db.paymentAttempt.findUnique.mockResolvedValue({ status: 'REFUNDED' });
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'refunded');

            await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));

            expect(sendBookingCreatedAlertEmail).not.toHaveBeenCalled();
        });
    });

    describe('expired Pix from an earlier attempt', () => {
        it('does not cancel the pending booking nor release its coupon', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture());
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'cancelled', {
                status_detail: 'expired',
                payment_method_id: 'pix',
                payment_type_id: 'bank_transfer',
            });

            const response = await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));
            const body = await response.json();

            expect(body).toMatchObject({ bookingStatus: 'PENDING' });
            expect(bookingUpdatesTo('CANCELLED')).toHaveLength(0);
            expect(db.couponRedemption.updateMany).not.toHaveBeenCalled();
        });
    });

    describe('approved payment after the room hold (deadline + grace)', () => {
        const lateCreatedAt = () => new Date(Date.now() - 3 * 60 * 60_000);

        it('confirms when the room is still available', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ createdAt: lateCreatedAt() }));
            vi.mocked(hasRoomForBooking).mockResolvedValueOnce(true);
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'approved');

            await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));

            expect(hasRoomForBooking).toHaveBeenCalledTimes(1);
            expect(bookingUpdatesTo('CONFIRMED')).toHaveLength(1);
            expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
        });

        it('does not confirm when the room was taken, and alerts the team', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ createdAt: lateCreatedAt() }));
            vi.mocked(hasRoomForBooking).mockResolvedValueOnce(false);
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'approved');

            await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));

            expect(bookingUpdatesTo('CONFIRMED')).toHaveLength(0);
            expect(bookingUpdatesTo('EXPIRED')).toHaveLength(1);
            expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
            expect(vi.mocked(sendDifficultyAlertEmail).mock.calls[0][0]).toMatchObject({
                step: 'Pagamento recebido sem quarto disponível',
            });
        });

        it('does not check availability while the room is still held', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ createdAt: new Date(Date.now() - 90 * 60_000) }));
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'approved');

            await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));

            expect(hasRoomForBooking).not.toHaveBeenCalled();
            expect(bookingUpdatesTo('CONFIRMED')).toHaveLength(1);
        });
    });

    describe('approved payment for an expired booking', () => {
        it('alerts the team on the first delivery', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'EXPIRED' }));
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'approved');

            await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));

            expect(sendDifficultyAlertEmail).toHaveBeenCalledTimes(1);
            expect(vi.mocked(sendDifficultyAlertEmail).mock.calls[0][0]).toMatchObject({
                step: 'Pagamento aprovado sem confirmação da reserva',
            });
        });

        it('does not send the "booking confirmed" email to the guest', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'EXPIRED' }));
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'approved');

            await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));

            expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
        });

        it('does not repeat the alert when the approval is redelivered', async () => {
            db.booking.findUnique.mockResolvedValue(bookingFixture({ status: 'EXPIRED', payment: approvedPaymentRow() }));
            mockMercadoPagoPayment(PRIMARY_PAYMENT_ID, 'approved');

            await handleMercadoPagoWebhook(webhookRequest(PRIMARY_PAYMENT_ID));

            expect(sendDifficultyAlertEmail).not.toHaveBeenCalled();
        });
    });
});
