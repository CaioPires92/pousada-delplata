import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();

vi.mock('mercadopago', () => {
    class MercadoPagoConfig {
        constructor(_: any) {}
    }

    class Payment {
        create = mockCreate;
        constructor(_: any) {}
    }

    return { MercadoPagoConfig, Payment };
});

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
        payment: {
            upsert: vi.fn(),
        },
        partialPaymentSettings: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { POST } from './route';

describe('POST /api/mercadopago/payment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.MP_ACCESS_TOKEN = 'TEST-test-token';

        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            totalPrice: 100,
            checkIn: new Date('2026-07-20T12:00:00Z'),
            payment: null,
        });
        (prisma.partialPaymentSettings.findUnique as any).mockResolvedValue(null);
    });

    it('returns 400 with PIX_NOT_ENABLED when MP account has no PIX key for QR', async () => {
        mockCreate.mockRejectedValue({
            status: 400,
            cause: [
                {
                    code: 13253,
                    description: 'Collector user without key enabled for QR rendernull',
                },
            ],
        });

        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 95,
                payment_method_id: 'pix',
                payer: { email: 'guest@example.com' },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('PIX_NOT_ENABLED');
        expect(String(data.message)).toContain('Pix indisponível');
    });

    it('allows PIX payment below card minimum when discounted booking total matches', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            totalPrice: 0.3,
            checkIn: new Date('2026-07-20T12:00:00Z'),
            payment: null,
        });

        mockCreate.mockResolvedValue({
            id: 'mp-1',
            status: 'pending',
        });

        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 0.29,
                payment_method_id: 'pix',
                payment_type_id: 'bank_transfer',
                payer: { email: 'guest@example.com' },
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(mockCreate).toHaveBeenCalled();
    });

    it('rejects forced partial payment when settings are disabled', async () => {
        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 50,
                payment_method_id: 'master',
                paymentMode: 'PARTIAL',
                payer: { email: 'guest@example.com' },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('partial_payment_not_allowed');
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('accepts partial payment when settings allow it', async () => {
        (prisma.partialPaymentSettings.findUnique as any).mockResolvedValue({
            enabled: true,
            percentage: 50,
            minimumBookingAmount: null,
            minimumLeadTimeDays: null,
            balanceDueAt: 'CHECK_IN',
            balanceDueDaysBeforeCheckIn: null,
            defaultPaymentMode: 'FULL',
        });
        mockCreate.mockResolvedValue({
            id: 'mp-1',
            status: 'pending',
        });

        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 50,
                payment_method_id: 'master',
                paymentMode: 'PARTIAL',
                payer: { email: 'guest@example.com' },
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({
                amount: 50,
                paymentMode: 'PARTIAL',
                totalAmount: 100,
                remainingAmount: 50,
            }),
        }));
    });

    it('returns 400 for invalid transaction_amount returned by MP', async () => {
        mockCreate.mockRejectedValue({
            status: 400,
            message: 'Invalid transaction_amount',
            cause: [{ description: 'Invalid transaction_amount' }],
        });

        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 100,
                payment_method_id: 'master',
                payer: { email: 'guest@example.com' },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('INVALID_TRANSACTION_AMOUNT');
    });
    it('returns 400 when Mercado Pago forbids the fallback test payer email', async () => {
        process.env.MP_TEST_PAYER_EMAIL = 'buyer@testuser.com';
        mockCreate.mockRejectedValue({
            status: 403,
            message: 'Payer email forbidden',
            cause: [{ description: 'Payer email forbidden' }],
        });

        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 95,
                payment_method_id: 'pix',
                payment_type_id: 'bank_transfer',
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('MP_PAYER_EMAIL_FORBIDDEN');
    });
    it('returns 400 with clear guidance when TEST credentials are used with a real payer email', async () => {
        delete process.env.MP_TEST_PAYER_EMAIL;
        mockCreate.mockRejectedValue({
            status: 500,
            message: 'internal_error',
        });

        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 100,
                payment_method_id: 'master',
                payer: { email: 'guest@example.com' },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('MP_TEST_USER_REQUIRED');
        expect(String(data.message)).toContain('MP_TEST_PAYER_EMAIL');
    });
    it('returns 500 for unknown MP errors', async () => {
        mockCreate.mockRejectedValue(new Error('boom'));

        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 100,
                payment_method_id: 'master',
                payer: { email: 'guest@example.com' },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe('Erro ao processar pagamento');
    });
});

