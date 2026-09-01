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
