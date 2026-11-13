import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { POST } from './route';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1' })),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            update: vi.fn((args: unknown) => args),
        },
        payment: {
            findFirst: vi.fn(),
            upsert: vi.fn((args: unknown) => args),
        },
        paymentAttempt: {
            findFirst: vi.fn(),
        },
        $transaction: vi.fn(async (operations: unknown[]) => operations),
    },
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

const booking = {
    id: 'booking-1',
    status: 'PENDING',
    checkIn: new Date('2026-12-29T00:00:00.000Z'),
    checkOut: new Date('2027-01-02T00:00:00.000Z'),
    totalPrice: 2519,
    adults: 2,
    children: 0,
    pets: 1,
    guest: {
        name: 'Edvaldo Junior Silva',
        email: 'edvaldo@example.com',
        phone: '5511999999999',
    },
    roomType: {
        id: 'room-1',
        name: 'Chalé',
    },
    payment: null,
};

describe('POST admin booking payment link (Asaas)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ASAAS_API_KEY = 'asaas-test-key';
        process.env.ASAAS_ENVIRONMENT = 'sandbox';
        process.env.NEXT_PUBLIC_BASE_URL = '  https://pousadadelplata.com.br/  ';
        (prisma.paymentAttempt.findFirst as any).mockResolvedValue(null);
        (prisma.payment.findFirst as any).mockResolvedValue(null);
    });

    function mockCheckoutCreated() {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 200,
            json: async () => ({ id: 'chk-123' }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    function callPost(bookingId = 'booking-1') {
        return POST(
            new Request(`https://pousadadelplata.com.br/api/admin/bookings/${bookingId}/payment-link`, { method: 'POST' }),
            { params: Promise.resolve({ bookingId }) }
        );
    }

    it('cria checkout no Asaas sem dados do pagador e com a reserva como externalReference', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        const fetchMock = mockCheckoutCreated();

        expect((await callPost()).status).toBe(200);
        expect(String(fetchMock.mock.calls[0][0])).toBe('https://api-sandbox.asaas.com/v3/checkouts');
        const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
        expect(payload).not.toHaveProperty('customerData');
        expect(payload).not.toHaveProperty('customer');
        expect(payload).toMatchObject({
            externalReference: 'booking-1',
            billingTypes: ['PIX', 'CREDIT_CARD'],
            minutesToExpire: 60,
        });
        expect(payload.items[0].value).toBe(2519);
        expect(payload.items[0].description).toContain('4 diária(s)');
        expect(payload.items[0].description).toContain('1 pet(s)');
        expect(payload.callback.successUrl).toMatch(/^https:\/\/pousadadelplata\.com\.br\/reservar\/confirmacao\/booking-1/);
    });

    it('cobra o valor registrado do pagamento (parcial) que o webhook vai validar', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            ...booking,
            payment: { status: 'PENDING', amount: 1259.5 },
        });
        const fetchMock = mockCheckoutCreated();

        await callPost();
        const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
        expect(payload.items[0].value).toBe(1259.5);
    });

    it('bloqueia novo link quando há cartão em análise no Mercado Pago', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        (prisma.paymentAttempt.findFirst as any).mockResolvedValue({ id: 'attempt-1' });
        const fetchMock = mockCheckoutCreated();

        const response = await callPost();
        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe('PAYMENT_UNDER_REVIEW');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('bloqueia novo link quando há cartão em análise no Asaas', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        (prisma.payment.findFirst as any).mockResolvedValue({ id: 'payment-1' });
        const fetchMock = mockCheckoutCreated();

        const response = await callPost();
        expect(response.status).toBe(409);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('gera link, mensagem de WhatsApp, grava o checkout e renova o prazo', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        mockCheckoutCreated();

        const response = await callPost();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.paymentLink).toBe('https://sandbox.asaas.com/checkoutSession/show?id=chk-123');
        expect(data.whatsappUrl).toContain('wa.me/5511999999999');
        expect(data.whatsappUrl).toContain('Edvaldo');
        expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { bookingId: 'booking-1' },
            update: { status: 'PENDING', provider: 'ASAAS', providerId: 'chk-123' },
        }));
        expect(prisma.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: expect.objectContaining({ funnelStage: 'PAYMENT_LINK_CREATED', paymentDeadlineAt: expect.any(Date) }),
        });
    });

    it('não grava nada quando o Asaas recusa o link', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: false,
            status: 400,
            json: async () => ({ errors: [{ code: 'invalid', description: 'Domínio não autorizado.' }] }),
        })));

        const response = await callPost();
        expect(response.status).toBe(400);
        expect((await response.json()).message).toBe('Domínio não autorizado.');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('recusa quando a chave do Asaas não está configurada', async () => {
        delete process.env.ASAAS_API_KEY;
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        const fetchMock = mockCheckoutCreated();

        const response = await callPost();
        expect(response.status).toBe(500);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('normalizes whitespace around bookingId', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        mockCheckoutCreated();

        const response = await callPost(' booking-1 ');

        expect(response.status).toBe(200);
        expect(prisma.booking.findUnique).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            include: { roomType: true, guest: true, payment: true },
        });
    });

    it('bloqueia reserva com pagamento aprovado', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            ...booking,
            payment: { status: 'APPROVED' },
        });

        const response = await callPost();
        expect(response.status).toBe(409);
    });
});
