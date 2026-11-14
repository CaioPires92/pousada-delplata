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
            update: vi.fn(),
        },
        paymentAttempt: {
            findFirst: vi.fn(),
        },
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
    pets: 0,
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

describe('POST admin booking payment link', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.MP_ACCESS_TOKEN = '  APP_USR-test  ';
        process.env.NEXT_PUBLIC_BASE_URL = '  https://pousadadelplata.com.br/  ';
        (prisma.paymentAttempt.findFirst as any).mockResolvedValue(null);
    });

    function mockPreferenceCreated() {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true,
            status: 201,
            json: async () => ({
                id: 'pref-123',
                init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123',
            }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    function callPost() {
        return POST(
            new Request('https://pousadadelplata.com.br/api/admin/bookings/booking-1/payment-link', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: 'booking-1' }) }
        );
    }

    it('envia item completo e não mistura dados do hóspede como pagador', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        (prisma.booking.update as any).mockResolvedValue(booking);
        const fetchMock = mockPreferenceCreated();

        expect((await callPost()).status).toBe(200);
        const preference = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
        expect(preference).not.toHaveProperty('payer');
        expect(preference.items[0]).toMatchObject({
            category_id: 'travels',
            unit_price: 2519,
            event_date: '2026-12-29T00:00:00.000Z',
        });
        expect(preference.items[0].description).toContain('4 diária(s)');
        expect(preference).toMatchObject({
            external_reference: 'booking-1',
            statement_descriptor: 'POUSADA DELPLATA',
            payment_methods: { excluded_payment_types: [{ id: 'ticket' }] },
        });
    });

    it('cobra o valor registrado do pagamento (parcial) que o webhook vai validar', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            ...booking,
            payment: { status: 'PENDING', amount: 1259.5 },
        });
        (prisma.booking.update as any).mockResolvedValue(booking);
        const fetchMock = mockPreferenceCreated();

        await callPost();
        const preference = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
        expect(preference.items[0].unit_price).toBe(1259.5);
    });

    it('bloqueia novo link quando há cartão em análise', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        (prisma.paymentAttempt.findFirst as any).mockResolvedValue({ id: 'attempt-1' });
        const fetchMock = mockPreferenceCreated();

        const response = await callPost();
        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe('PAYMENT_UNDER_REVIEW');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('gera link, mensagem de WhatsApp e atualiza o funil', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        (prisma.booking.update as any).mockResolvedValue(booking);
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            status: 201,
            json: async () => ({
                id: 'pref-123',
                init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123',
            }),
        })));

        const response = await POST(
            new Request('https://pousadadelplata.com.br/api/admin/bookings/booking-1/payment-link', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: 'booking-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.paymentLink).toContain('pref-123');
        expect(data.whatsappUrl).toContain('wa.me/5511999999999');
        expect(data.whatsappUrl).toContain('Edvaldo');
        expect(prisma.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: expect.objectContaining({ funnelStage: 'PAYMENT_LINK_CREATED' }),
        });
    });

    it('normalizes whitespace around bookingId', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(booking);
        (prisma.booking.update as any).mockResolvedValue(booking);
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            status: 201,
            json: async () => ({
                id: 'pref-123',
                init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123',
            }),
        })));

        const response = await POST(
            new Request('https://pousadadelplata.com.br/api/admin/bookings/ booking-1 /payment-link', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: ' booking-1 ' }) }
        );

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

        const response = await POST(
            new Request('https://pousadadelplata.com.br/api/admin/bookings/booking-1/payment-link', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: 'booking-1' }) }
        );

        expect(response.status).toBe(409);
    });
});
