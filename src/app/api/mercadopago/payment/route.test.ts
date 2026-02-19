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
        },
        payment: {
            upsert: vi.fn(),
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
        process.env.MP_ACCESS_TOKEN = 'test-token';

        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            totalPrice: 100,
            payment: null,
        });
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
                transaction_amount: 100,
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

    it('persists card brand from MP response even without payment_type_id in request', async () => {
        mockCreate.mockResolvedValue({
            id: 123456,
            status: 'pending',
            payment_method_id: 'master',
            payment_type_id: 'credit_card',
        });

        const req = new Request('http://localhost/api/mercadopago/payment', {
            method: 'POST',
            body: JSON.stringify({
                bookingId: 'booking-1',
                transaction_amount: 100,
                payment_method_id: 'master',
                installments: 2,
                payer: { email: 'guest@example.com' },
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(prisma.payment.upsert).toHaveBeenCalledTimes(1);
        const upsertArgs = (prisma.payment.upsert as any).mock.calls[0][0];
        expect(upsertArgs.update.method).toBe('CREDIT_CARD');
        expect(upsertArgs.update.cardBrand).toBe('MASTER');
        expect(upsertArgs.update.installments).toBe(2);
    });
});
