import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1' })),
}));
vi.mock('@/lib/ops-log', () => ({ opsLog: vi.fn() }));
vi.mock('@/lib/email', () => ({
    sendGuestDiscountEmail: vi.fn(async () => ({ success: true, messageId: 'message-1' })),
}));
vi.mock('@/lib/prisma', () => ({
    default: {
        booking: { findUnique: vi.fn() },
        coupon: { findFirst: vi.fn() },
        couponRedemption: { count: vi.fn() },
    },
}));

import prisma from '@/lib/prisma';
import { sendGuestDiscountEmail } from '@/lib/email';
import { POST } from './route';

const context = { params: Promise.resolve({ bookingId: 'booking-1' }) };

describe('POST /api/admin/bookings/[bookingId]/discount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            guest: {
                name: 'Maria Silva',
                email: 'Maria@Example.com',
                phone: '(19) 99999-9999',
            },
        });
        (prisma.coupon.findFirst as any).mockResolvedValue({
            id: 'coupon-1',
            type: 'PERCENT',
            value: 10,
            active: true,
            startsAt: null,
            endsAt: new Date('2026-08-31T12:00:00Z'),
            maxGlobalUses: 20,
            bindEmail: null,
            bindPhone: null,
        });
        (prisma.couponRedemption.count as any).mockResolvedValue(2);
    });

    it('envia um convite de retorno sem criar ou exigir cupom', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/discount', {
            method: 'POST',
            body: JSON.stringify({ channels: { email: true, whatsapp: true } }),
        }), context);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toBeNull();
        expect(data.whatsappUrl).toContain('wa.me/5519999999999');
        expect(decodeURIComponent(data.whatsappUrl)).not.toContain('cupom');
        expect(prisma.coupon.findFirst).not.toHaveBeenCalled();
        expect(sendGuestDiscountEmail).toHaveBeenCalledWith(expect.objectContaining({
            bookingUrl: 'https://www.pousadadelplata.com.br/reservar',
            code: undefined,
        }));
    });

    it('valida e inclui um cupom ativo escolhido pelo administrador', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/discount', {
            method: 'POST',
            body: JSON.stringify({
                channels: { email: true, whatsapp: true },
                couponCode: 'VOLTA10',
            }),
        }), context);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toBe('VOLTA10');
        expect(decodeURIComponent(data.whatsappUrl)).toContain('cupom *VOLTA10*');
        expect(sendGuestDiscountEmail).toHaveBeenCalledWith(expect.objectContaining({
            code: 'VOLTA10',
            discountLabel: '10% de desconto',
            bookingUrl: expect.stringContaining('promo=VOLTA10'),
        }));
    });

    it('rejeita cupom inexistente ou inativo', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValueOnce(null);
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/discount', {
            method: 'POST',
            body: JSON.stringify({
                channels: { email: true, whatsapp: false },
                couponCode: 'INVALIDO',
            }),
        }), context);

        expect(response.status).toBe(404);
        expect(sendGuestDiscountEmail).not.toHaveBeenCalled();
    });

    it('rejeita solicitações sem canal de envio', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/discount', {
            method: 'POST',
            body: JSON.stringify({ channels: { email: false, whatsapp: false } }),
        }), context);

        expect(response.status).toBe(400);
        expect(sendGuestDiscountEmail).not.toHaveBeenCalled();
    });
});
