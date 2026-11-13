import { beforeEach, describe, expect, it, vi } from 'vitest';

import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';
import { POST } from './route';

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        payment: {
            upsert: vi.fn(),
        },
        paymentAttempt: {
            findFirst: vi.fn(),
        },
        partialPaymentSettings: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

vi.mock('@/lib/ops-log', () => ({ opsLog: vi.fn() }));

const booking = {
    id: 'booking-1',
    status: 'PENDING',
    adults: 2,
    children: 0,
    checkIn: new Date('2026-12-29T00:00:00.000Z'),
    checkOut: new Date('2027-01-02T00:00:00.000Z'),
    totalPrice: 3796,
    createdAt: new Date(Date.now() - 5 * 60_000),
    paymentDeadlineAt: null,
    guest: {
        name: 'Maria da Silva',
        email: 'maria@example.com',
        phone: '+55 (19) 99900-2288',
    },
    roomType: { id: 'room-1', name: 'Quarto Triplo' },
    payment: null,
};

function createRequest(body: Record<string, unknown>) {
    return new Request('https://www.pousadadelplata.com.br/api/mercadopago/checkout-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

// Ids distintos evitam o limite em memória por reserva entre testes (o mock devolve a mesma reserva).
let payerRequestSeq = 0;

describe('POST Mercado Pago hosted checkout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.MP_ACCESS_TOKEN = 'APP_USR-test';
        process.env.NEXT_PUBLIC_BASE_URL = 'https://www.pousadadelplata.com.br';
        process.env.ENABLE_TEST_PAYMENTS = 'false';
        process.env.BOOKING_ACCESS_SECRET = 'test-booking-access-secret';
        delete process.env.MP_TEST_PAYER_EMAIL;
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        (prisma.partialPaymentSettings.findUnique as any).mockResolvedValue(null);
        (prisma.payment.upsert as any).mockResolvedValue({});
        (prisma.paymentAttempt.findFirst as any).mockResolvedValue(null);
        (prisma.booking.update as any).mockResolvedValue({});
        (prisma.$transaction as any).mockResolvedValue([]);
    });

    it('creates a Checkout Pro preference and preserves webhook reconciliation data', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 201,
            json: async () => ({
                id: 'pref-123',
                init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123',
            }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(createRequest({
            bookingId: booking.id,
            guestEmail: ' MARIA@example.com ',
            payerCpf: '529.982.247-25',
            paymentMode: 'FULL',
            deviceId: ' device-session-123 ',
        }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.initPoint).toContain('pref-123');
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const headers = new Headers(request.headers);
        const preference = JSON.parse(String(request.body));
        expect(headers.get('X-meli-session-id')).toBe('device-session-123');
        expect(String(request.body)).not.toContain('device-session-123');
        expect(JSON.stringify(data)).not.toContain('device-session-123');
        expect(JSON.stringify((prisma.payment.upsert as any).mock.calls)).not.toContain('device-session-123');
        expect(preference).toMatchObject({
            external_reference: 'booking-1',
            notification_url: 'https://www.pousadadelplata.com.br/api/webhooks/mercadopago',
            payer: {
                name: 'Maria',
                surname: 'da Silva',
                email: 'maria@example.com',
                phone: { area_code: '19', number: '999002288' },
                identification: { type: 'CPF', number: '52998224725' },
            },
            items: [{
                unit_price: 3796,
                currency_id: 'BRL',
                event_date: '2026-12-29T00:00:00.000Z',
            }],
            payment_methods: {
                excluded_payment_types: [{ id: 'ticket' }],
                installments: 12,
            },
        });
        expect(preference.items[0].category_id).toBe('travels');
        expect(headers.get('X-Idempotency-Key')).toMatch(/^hosted-checkout-booking-1-FULL-prod-v3-[0-9a-f]{32}$/);
        expect(preference.items[0].description).toContain('4 diária(s), 2026-12-29 a 2027-01-02');
        expect(preference).not.toHaveProperty('purpose');
        expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { bookingId: 'booking-1' },
            create: expect.objectContaining({
                provider: 'MERCADOPAGO_CHECKOUT_PRO',
                providerId: 'pref-123',
                status: 'PENDING',
            }),
        }));
    });

    it('omits X-meli-session-id when the Device ID is absent', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 201,
            json: async () => ({ id: 'pref-no-device', init_point: 'https://mercadopago.test/no-device' }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(createRequest({
            bookingId: booking.id,
            guestEmail: booking.guest.email,
            payerCpf: '52998224725',
        }));

        expect(response.status).toBe(200);
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(new Headers(request.headers).has('X-meli-session-id')).toBe(false);
    });

    it('sends only the third-party payer identity and keeps the guest record untouched', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 201,
            json: async () => ({ id: 'pref-third', init_point: 'https://mercadopago.test/third' }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(createRequest({
            bookingId: `booking-payer-${++payerRequestSeq}`,
            guestEmail: booking.guest.email,
            payerCpf: '529.982.247-25',
            paymentMode: 'FULL',
            deviceId: 'device-third',
            payer: { type: 'THIRD_PARTY', name: 'João Pereira Souza', email: 'joao@example.com', phone: '(11) 98888-7777' },
        }));

        expect(response.status).toBe(200);
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const headers = new Headers(request.headers);
        const preference = JSON.parse(String(request.body));
        expect(preference.payer).toEqual({
            name: 'João',
            surname: 'Pereira Souza',
            email: 'joao@example.com',
            phone: { area_code: '11', number: '988887777' },
            identification: { type: 'CPF', number: '52998224725' },
        });
        expect(JSON.stringify(preference.payer)).not.toContain('Maria');
        expect(JSON.stringify(preference.payer)).not.toContain('maria@example.com');
        expect(headers.get('X-meli-session-id')).toBe('device-third');
        expect(preference.items[0]).toMatchObject({ unit_price: 3796, quantity: 1, category_id: 'travels' });
        expect(booking.guest).toEqual({ name: 'Maria da Silva', email: 'maria@example.com', phone: '+55 (19) 99900-2288' });
        const bookingUpdateData = (prisma.booking.update as any).mock.calls[0]?.[0]?.data;
        expect(Object.keys(bookingUpdateData).sort()).toEqual(['funnelStage', 'funnelUpdatedAt', 'lastErrorMessage']);
        const persisted = JSON.stringify([
            (prisma.payment.upsert as any).mock.calls,
            (prisma.booking.update as any).mock.calls,
        ]);
        for (const sensitive of ['52998224725', 'João', 'joao@example.com', '988887777']) {
            expect(persisted).not.toContain(sensitive);
        }
    });

    it('does not fill a third-party payer with guest email or phone', async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 201,
            json: async () => ({ id: 'pref-third-min', init_point: 'https://mercadopago.test/third-min' }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(createRequest({
            bookingId: `booking-payer-${++payerRequestSeq}`,
            guestEmail: booking.guest.email,
            payerCpf: '52998224725',
            payer: { type: 'THIRD_PARTY', name: 'João Pereira' },
        }));

        expect(response.status).toBe(200);
        const preference = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
        expect(preference.payer).toEqual({
            name: 'João',
            surname: 'Pereira',
            identification: { type: 'CPF', number: '52998224725' },
        });
    });

    it.each([
        ['name', { type: 'THIRD_PARTY', name: 'João' }],
        ['name', { type: 'THIRD_PARTY' }],
        ['email', { type: 'THIRD_PARTY', name: 'João Pereira', email: 'joao@' }],
        ['phone', { type: 'THIRD_PARTY', name: 'João Pereira', phone: '12345' }],
        ['type', { type: 'COMPANY', name: 'Empresa Ltda' }],
    ])('rejects incomplete third-party payer data (%s) without creating a preference', async (field, payer) => {
        vi.stubGlobal('fetch', vi.fn());

        const response = await POST(createRequest({
            bookingId: `booking-payer-${++payerRequestSeq}`,
            guestEmail: booking.guest.email,
            payerCpf: '52998224725',
            payer,
        }));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toMatchObject({ error: 'INVALID_PAYER_DATA', field });
        expect(JSON.stringify(data)).not.toContain('João');
        expect(JSON.stringify(data)).not.toContain('52998224725');
        expect(fetch).not.toHaveBeenCalled();
        expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('keeps CPF and payer data out of logs when Mercado Pago rejects the preference', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: false,
            status: 400,
            // Mensagem do MP ecoando dados do pagador: não pode chegar ao log.
            json: async () => ({
                error: 'bad_request',
                message: 'invalid payer.email joao@example.com for identification 52998224725',
                cause: [{ code: 'invalid_payer', description: 'payer João Pereira invalid' }],
            }),
        })));

        const response = await POST(createRequest({
            bookingId: `booking-payer-${++payerRequestSeq}`,
            guestEmail: booking.guest.email,
            payerCpf: '529.982.247-25',
            payer: { type: 'THIRD_PARTY', name: 'João Pereira', email: 'joao@example.com', phone: '(11) 98888-7777' },
        }));

        expect(response.status).toBe(400);
        expect(opsLog).toHaveBeenCalled();
        const logged = JSON.stringify((opsLog as any).mock.calls);
        expect(logged).toContain('invalid_payer');
        for (const sensitive of ['52998224725', '529.982.247-25', 'João', 'joao@example.com', '988887777', 'maria@example.com']) {
            expect(logged).not.toContain(sensitive);
        }
    });

    it('rejects an invalid CPF before creating a preference', async () => {
        const response = await POST(createRequest({
            bookingId: booking.id,
            guestEmail: booking.guest.email,
            payerCpf: '111.111.111-11',
        }));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'INVALID_PAYER_IDENTIFICATION' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('does not expose booking existence when guest email does not match', async () => {
        const response = await POST(createRequest({
            bookingId: booking.id,
            guestEmail: 'other@example.com',
            payerCpf: '52998224725',
        }));

        expect(response.status).toBe(404);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('preserves a valid partial-payment plan for webhook confirmation', async () => {
        (prisma.partialPaymentSettings.findUnique as any).mockResolvedValue({
            enabled: true,
            percentage: 50,
            minimumBookingAmount: null,
            minimumLeadTimeDays: null,
            balanceDueAt: 'CHECK_IN',
            balanceDueDaysBeforeCheckIn: null,
            defaultPaymentMode: 'PARTIAL',
        });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            status: 201,
            json: async () => ({ id: 'pref-partial', init_point: 'https://mercadopago.test/partial' }),
        })));

        const response = await POST(createRequest({
            bookingId: booking.id,
            guestEmail: booking.guest.email,
            payerCpf: '52998224725',
            paymentMode: 'PARTIAL',
        }));

        expect(response.status).toBe(200);
        expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({
                amount: 1898,
                totalAmount: 3796,
                remainingAmount: 1898,
                paymentMode: 'PARTIAL',
                balanceDueAt: 'CHECK_IN',
            }),
        }));
    });

    it('allows hosted checkout for reservations below the former high-value threshold', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({ ...booking, totalPrice: 500 });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            status: 201,
            json: async () => ({ id: 'pref-standard', init_point: 'https://mercadopago.test/standard' }),
        })));

        const response = await POST(createRequest({
            bookingId: booking.id,
            guestEmail: booking.guest.email,
            payerCpf: '52998224725',
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ initPoint: 'https://mercadopago.test/standard' });
    });

    it('does not send public callback options with a localhost URL', async () => {
        process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3005';
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 201,
            json: async () => ({ id: 'pref-local', init_point: 'https://mercadopago.test/local' }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(createRequest({
            bookingId: booking.id,
            guestEmail: booking.guest.email,
            payerCpf: '52998224725',
        }));

        expect(response.status).toBe(200);
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const preference = JSON.parse(String(request.body));
        expect(preference).not.toHaveProperty('notification_url');
        expect(preference).not.toHaveProperty('back_urls');
        expect(preference).not.toHaveProperty('auto_return');
    });

    it('does not bind a real guest to a test Checkout Pro preference', async () => {
        process.env.ENABLE_TEST_PAYMENTS = 'true';
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 201,
            json: async () => ({
                id: 'pref-test',
                init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-test',
                sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-test',
            }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(createRequest({
            bookingId: booking.id,
            guestEmail: booking.guest.email,
        }));

        expect(response.status).toBe(200);
        expect(await response.clone().json()).toMatchObject({
            initPoint: expect.stringContaining('www.mercadopago.com.br'),
        });
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const preference = JSON.parse(String(request.body));
        expect(preference).not.toHaveProperty('payer');
    });
    describe('idempotência da preferência', () => {
        function mockPreferenceApi() {
            let sequence = 0;
            const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
                sequence += 1;
                return {
                    ok: true,
                    status: 201,
                    json: async () => ({ id: `pref-${sequence}`, init_point: `https://mercadopago.test/${sequence}` }),
                };
            });
            vi.stubGlobal('fetch', fetchMock);
            return fetchMock;
        }

        function sentIdempotencyKeys(fetchMock: ReturnType<typeof mockPreferenceApi>) {
            return fetchMock.mock.calls.map((call) => new Headers((call[1] as RequestInit).headers).get('X-Idempotency-Key'));
        }

        function checkoutBody(overrides: Record<string, unknown> = {}) {
            return {
                bookingId: `booking-idem-${++payerRequestSeq}`,
                guestEmail: booking.guest.email,
                payerCpf: '52998224725',
                paymentMode: 'FULL',
                ...overrides,
            };
        }

        // O servidor não tem trava própria: requisições concorrentes chegam ao MP com a MESMA chave.
        // A deduplicação pelo MP em /checkout/preferences não é documentada; a trava efetiva contra
        // duplo clique é a do cliente (hostedCheckoutSubmitLockRef + isSubmittingPayment).
        it('envia a mesma chave em retry e em requisições concorrentes com os mesmos dados (sem trava no servidor)', async () => {
            const fetchMock = mockPreferenceApi();

            const [first, second] = await Promise.all([
                POST(createRequest(checkoutBody())),
                POST(createRequest(checkoutBody())),
            ]);
            // Retry 2 minutos depois: o token de acesso em back_urls muda (exp), a chave não.
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date(Date.now() + 2 * 60_000));
            const retry = await POST(createRequest(checkoutBody({ deviceId: 'device-retry' })));
            vi.useRealTimers();

            expect([first.status, second.status, retry.status]).toEqual([200, 200, 200]);
            const keys = sentIdempotencyKeys(fetchMock);
            expect(keys).toHaveLength(3);
            expect(new Set(keys).size).toBe(1);
            const successUrls = fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)).back_urls.success);
            expect(successUrls[0]).not.toBe(successUrls[2]);
        });

        it('gera nova chave quando o pagador muda legitimamente', async () => {
            const fetchMock = mockPreferenceApi();

            await POST(createRequest(checkoutBody()));
            await POST(createRequest(checkoutBody({ payerCpf: '11144477735' })));
            await POST(createRequest(checkoutBody({ payer: { type: 'THIRD_PARTY', name: 'João Pereira' } })));
            await POST(createRequest(checkoutBody({ payer: { type: 'THIRD_PARTY', name: 'João Pereira', email: 'joao@example.com' } })));

            const keys = sentIdempotencyKeys(fetchMock);
            expect(keys).toHaveLength(4);
            expect(new Set(keys).size).toBe(4);
            const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)));
            expect(bodies[2].payer).toEqual({
                name: 'João',
                surname: 'Pereira',
                identification: { type: 'CPF', number: '52998224725' },
            });
        });

        it('gera nova chave quando a modalidade ou o valor mudam', async () => {
            (prisma.partialPaymentSettings.findUnique as any).mockResolvedValue({
                enabled: true,
                percentage: 50,
                minimumBookingAmount: null,
                minimumLeadTimeDays: null,
                balanceDueAt: 'CHECK_IN',
                balanceDueDaysBeforeCheckIn: null,
                defaultPaymentMode: 'FULL',
            });
            const fetchMock = mockPreferenceApi();

            await POST(createRequest(checkoutBody({ paymentMode: 'FULL' })));
            await POST(createRequest(checkoutBody({ paymentMode: 'PARTIAL' })));
            (prisma.booking.findUnique as any).mockResolvedValue({ ...booking, totalPrice: 3500 });
            await POST(createRequest(checkoutBody({ paymentMode: 'FULL' })));

            const keys = sentIdempotencyKeys(fetchMock);
            expect(keys[0]).toContain('-FULL-');
            expect(keys[1]).toContain('-PARTIAL-');
            expect(new Set(keys).size).toBe(3);
            const unitPrices = fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)).items[0].unit_price);
            expect(unitPrices).toEqual([3796, 1898, 3500]);
        });

        it('não expõe dados pessoais na chave nem nos logs', async () => {
            const fetchMock = mockPreferenceApi();

            await POST(createRequest(checkoutBody({
                payerCpf: '529.982.247-25',
                payer: { type: 'THIRD_PARTY', name: 'João Pereira', email: 'joao@example.com', phone: '(11) 98888-7777' },
            })));

            const [key] = sentIdempotencyKeys(fetchMock);
            expect(key).toMatch(/^hosted-checkout-booking-1-FULL-prod-v3-[0-9a-f]{32}$/);
            expect(key!.length).toBeLessThanOrEqual(128);
            const inspected = `${key} ${JSON.stringify((opsLog as any).mock.calls)}`;
            for (const sensitive of ['52998224725', '529.982.247-25', 'João', 'joao@example.com', '988887777', 'Maria', 'maria@example.com', '999002288']) {
                expect(inspected).not.toContain(sensitive);
            }
        });

        it('sem segredo server-side, mantém chave sem dados do pagador e registra aviso sem PII', async () => {
            delete process.env.BOOKING_ACCESS_SECRET;
            delete process.env.ADMIN_JWT_SECRET;
            const fetchMock = mockPreferenceApi();

            const response = await POST(createRequest(checkoutBody()));

            expect(response.status).toBe(200);
            expect(sentIdempotencyKeys(fetchMock)).toEqual(['hosted-checkout-booking-1-FULL-prod-v3']);
            expect(opsLog).toHaveBeenCalledWith('warn', 'MP_HOSTED_CHECKOUT_IDEMPOTENCY_WITHOUT_SECRET', { bookingIdShort: 'booking-' });
        });

        it('não abre nova preferência com pagamento de cartão em análise', async () => {
            (prisma.paymentAttempt.findFirst as any).mockResolvedValue({ id: 'attempt-1' });
            const fetchMock = mockPreferenceApi();

            const response = await POST(createRequest(checkoutBody({ payer: { type: 'THIRD_PARTY', name: 'João Pereira' } })));

            expect(response.status).toBe(409);
            expect(await response.json()).toMatchObject({ error: 'PAYMENT_UNDER_REVIEW' });
            const query = (prisma.paymentAttempt.findFirst as any).mock.calls[0][0];
            expect(query.where).toMatchObject({ bookingId: 'booking-1', status: { in: ['IN_PROCESS', 'AUTHORIZED'] } });
            // Janela de 3 dias: tentativa parada há mais tempo (webhook perdido) não trava a reserva.
            const windowMs = Date.now() - query.where.updatedAt.gte.getTime();
            expect(windowMs).toBeGreaterThanOrEqual(3 * 24 * 60 * 60 * 1000 - 5_000);
            expect(windowMs).toBeLessThanOrEqual(3 * 24 * 60 * 60 * 1000 + 5_000);
            expect(fetchMock).not.toHaveBeenCalled();
            expect(prisma.payment.upsert).not.toHaveBeenCalled();
        });

        it('não sobrescreve pagamento já aprovado', async () => {
            (prisma.booking.findUnique as any).mockResolvedValue({
                ...booking,
                payment: { status: 'APPROVED', provider: 'MERCADOPAGO_CHECKOUT_PRO', providerId: 'pref-paid' },
            });
            const fetchMock = mockPreferenceApi();

            const response = await POST(createRequest(checkoutBody({ payer: { type: 'THIRD_PARTY', name: 'João Pereira' } })));

            expect(response.status).toBe(409);
            expect(fetchMock).not.toHaveBeenCalled();
            expect(prisma.payment.upsert).not.toHaveBeenCalled();
        });

        it('segue sem a verificação de análise quando a tabela de histórico falha, com aviso sem PII', async () => {
            (prisma.paymentAttempt.findFirst as any).mockRejectedValue(new Error('no such table: PaymentAttempt'));
            const fetchMock = mockPreferenceApi();

            const response = await POST(createRequest(checkoutBody({ payer: { type: 'THIRD_PARTY', name: 'João Pereira' } })));

            expect(response.status).toBe(200);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(opsLog).toHaveBeenCalledWith('warn', 'MP_HOSTED_CHECKOUT_REVIEW_CHECK_FAILED', {
                bookingIdShort: 'booking-',
                message: 'Error',
            });
        });

        it('registra a troca de preferência sem PII quando o pagador muda', async () => {
            (prisma.booking.findUnique as any).mockResolvedValue({
                ...booking,
                payment: { status: 'PENDING', provider: 'MERCADOPAGO_CHECKOUT_PRO', providerId: 'pref-old' },
            });
            mockPreferenceApi();

            const response = await POST(createRequest(checkoutBody({ payer: { type: 'THIRD_PARTY', name: 'João Pereira' } })));

            expect(response.status).toBe(200);
            expect(opsLog).toHaveBeenCalledWith('info', 'MP_HOSTED_CHECKOUT_PREFERENCE_REPLACED', {
                bookingIdShort: 'booking-',
                previousProvider: 'MERCADOPAGO_CHECKOUT_PRO',
                previousProviderId: 'pref-old',
                previousPaymentStatus: 'PENDING',
                preferenceId: 'pref-1',
            });
            expect(JSON.stringify((opsLog as any).mock.calls)).not.toContain('João');
        });
    });
});
