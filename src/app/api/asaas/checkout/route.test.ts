import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { POST } from './route';

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: { findUnique: vi.fn(), update: vi.fn() },
        partialPaymentSettings: { findUnique: vi.fn() },
        payment: { upsert: vi.fn(), findFirst: vi.fn() },
        paymentAttempt: { findFirst: vi.fn() },
        $transaction: vi.fn(),
    },
}));

vi.mock('@/lib/booking-access', () => ({
    getBookingAccessCookieName: () => 'booking-access',
    getBookingAccessCookieOptions: () => ({}),
    signBookingAccessToken: vi.fn(async () => 'token'),
}));

vi.mock('@/lib/ops-log', () => ({ opsLog: vi.fn() }));

const VALID_CPF = '529.982.247-25';

const booking = (extra: Record<string, unknown> = {}) => ({
    id: 'booking-abc12345',
    status: 'PENDING',
    checkIn: new Date('2027-01-10T00:00:00.000Z'),
    checkOut: new Date('2027-01-12T00:00:00.000Z'),
    totalPrice: 898,
    adults: 2,
    children: 0,
    pets: 1,
    createdAt: new Date(Date.now() - 5 * 60_000),
    paymentDeadlineAt: null,
    guest: { id: 'g1', name: 'Maria Silva', email: 'maria@example.com', phone: '(11) 99999-0000' },
    roomType: { id: 'r1', name: 'Chalé' },
    payment: null,
    ...extra,
});

const billing = { postalCode: '13720-000', address: 'Rua das Flores', addressNumber: '120', province: 'Centro' };

function request(body: Record<string, unknown> = {}) {
    return new Request('https://www.example.com/api/asaas/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
        body: JSON.stringify({ bookingId: 'booking-abc12345', guestEmail: 'maria@example.com', payerCpf: VALID_CPF, ...body }),
    });
}

const ok = (id: string) => ({ ok: true, status: 200, json: async () => ({ id }) });
const bodyOf = (fetchMock: any, call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

describe('POST /api/asaas/checkout', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_BASE_URL = 'https://www.example.com';
        process.env.ASAAS_API_KEY = '$aact_test';
        process.env.ASAAS_ENVIRONMENT = 'production';
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        (prisma.partialPaymentSettings.findUnique as any).mockResolvedValue(null);
        (prisma.paymentAttempt.findFirst as any).mockResolvedValue(null);
        (prisma.payment.findFirst as any).mockResolvedValue(null);
        (prisma.$transaction as any).mockResolvedValue([]);
    });

    afterEach(() => vi.unstubAllGlobals());

    it('sem endereço, cria o checkout sem dados do pagador e grava o pagamento pendente do Asaas', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking());
        fetchMock.mockResolvedValue(ok('chk_1'));

        const response = await POST(request());
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.initPoint).toBe('https://asaas.com/checkoutSession/show?id=chk_1');
        expect(data.bookingAccessToken).toBe('token');
        expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.asaas.com/v3/checkouts');
        const body = bodyOf(fetchMock);
        expect(body.customerData).toBeUndefined();
        expect(body.customer).toBeUndefined();
        expect(body).toMatchObject({
            externalReference: 'booking-abc12345',
            billingTypes: ['PIX', 'CREDIT_CARD'],
            chargeTypes: ['DETACHED', 'INSTALLMENT'],
        });
        expect(body.items[0].value).toBe(898);
        expect(body.items[0].description).toContain('Chalé');
        expect(body.items[0].description).toContain('1 pet(s)');
        expect(body.callback.successUrl).toBe('https://www.example.com/reservar/confirmacao/booking-abc12345?access=token');
        expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ status: 'PENDING', provider: 'ASAAS', providerId: 'chk_1' }),
        }));
    });

    it('hóspede pagando com endereço completo: checkout abre preenchido com o CPF informado', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking());
        fetchMock.mockResolvedValue(ok('chk_2'));

        expect((await POST(request({ billing }))).status).toBe(200);
        expect(bodyOf(fetchMock).customerData).toMatchObject({
            name: 'Maria Silva',
            email: 'maria@example.com',
            cpfCnpj: '52998224725',
            phone: '11999990000',
            postalCode: '13720000',
            address: 'Rua das Flores',
            addressNumber: 120,
            province: 'Centro',
        });
    });

    it('terceiro pagando: não envia os dados do hóspede ao Asaas', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking());
        fetchMock.mockResolvedValue(ok('chk_3'));

        const response = await POST(request({
            billing,
            payer: { type: 'THIRD_PARTY', name: 'João Pereira', email: 'joao@example.com', phone: '' },
        }));
        expect(response.status).toBe(200);
        expect(bodyOf(fetchMock).customerData).toBeUndefined();
    });

    it('se o Asaas recusar customerData, tenta de novo sem ele e não trava a venda', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking());
        fetchMock
            .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ errors: [{ description: 'O campo address deve ser informado.' }] }) })
            .mockResolvedValueOnce(ok('chk_4'));

        const response = await POST(request({ billing }));
        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(bodyOf(fetchMock, 0).customerData).toBeDefined();
        expect(bodyOf(fetchMock, 1).customerData).toBeUndefined();
    });

    it('não grava nada quando o Asaas recusa o checkout', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking());
        fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ errors: [{ description: 'Chave inválida' }] }) });

        const response = await POST(request());
        expect(response.status).toBe(401);
        expect((await response.json()).error).toBe('PAYMENT_LINK_CREATE_FAILED');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('exige CPF válido', async () => {
        const response = await POST(request({ payerCpf: '111.111.111-11' }));
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('INVALID_PAYER_IDENTIFICATION');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('não encontra reserva de outro e-mail', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking());
        const response = await POST(request({ guestEmail: 'outra@example.com' }));
        expect(response.status).toBe(404);
    });

    it('o link do Asaas vence junto com o prazo da reserva', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking({
            paymentDeadlineAt: new Date(Date.now() + 25 * 60_000 + 30_000),
        }));
        fetchMock.mockResolvedValue(ok('chk_5'));

        await POST(request());
        expect(bodyOf(fetchMock).minutesToExpire).toBe(25);
    });

    it('recusa abrir pagamento quando o prazo da reserva terminou', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking({
            paymentDeadlineAt: new Date(Date.now() + 5 * 60_000),
        }));

        const response = await POST(request());
        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe('PAYMENT_WINDOW_CLOSED');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('recusa novo checkout com cartão em análise no Asaas', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking());
        (prisma.payment.findFirst as any).mockResolvedValue({ id: 'p1' });

        const response = await POST(request());
        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe('PAYMENT_UNDER_REVIEW');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('cobra o sinal quando o hóspede escolhe pagamento parcial', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking());
        (prisma.partialPaymentSettings.findUnique as any).mockResolvedValue({
            enabled: true,
            percentage: 50,
            minimumBookingAmount: null,
            minimumLeadTimeDays: 0,
            balanceDueAt: 'CHECK_IN',
            balanceDueDaysBeforeCheckIn: 0,
            defaultPaymentMode: 'FULL',
        });
        fetchMock.mockResolvedValue(ok('chk_6'));

        const response = await POST(request({ paymentMode: 'PARTIAL' }));
        expect(response.status).toBe(200);
        expect(bodyOf(fetchMock).items[0].value).toBe(449);
    });
});
