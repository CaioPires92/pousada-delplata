import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1', email: 'admin@example.com', role: 'admin' })),
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
    sendBookingPendingEmail: vi.fn(async () => ({ success: true, messageId: 'msg-1' })),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        coupon: {
            findFirst: vi.fn(),
        },
        couponRedemption: {
            count: vi.fn(),
        },
    },
}));

import prisma from '@/lib/prisma';
import { sendBookingPendingEmail } from '@/lib/email';
import { POST } from './route';

describe('POST /api/admin/bookings/[bookingId]/assist-email', () => {
    const assistRequest = (body: Record<string, unknown> = { channels: { email: true, whatsapp: false } }) =>
        new Request('http://localhost/api/admin/bookings/booking-1/assist-email', {
            method: 'POST',
            body: JSON.stringify(body),
        });

    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'PENDING',
            pendingEmailSentAt: null,
            createdAt: new Date('2026-02-24T18:00:00.000Z'),
            checkIn: new Date('2026-03-10T00:00:00.000Z'),
            checkOut: new Date('2026-03-12T00:00:00.000Z'),
            totalPrice: 450,
            adults: 2,
            children: 0,
            childrenAges: null,
            guest: { name: 'Hospede', email: 'guest@example.com', phone: '19999999999' },
            roomType: { name: 'Apartamento' },
            payment: { status: 'PENDING', method: 'PIX', installments: null },
        });
        (prisma.booking.update as any).mockResolvedValue({ id: 'booking-1' });
    });

    it('sends assist email and updates pendingEmailSentAt', async () => {
        const response = await POST(assistRequest(), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(sendBookingPendingEmail).toHaveBeenCalledTimes(1);
        expect(prisma.booking.update).toHaveBeenCalledTimes(1);
    });

    it('returns cooldown when pending email was sent recently', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'PENDING',
            pendingEmailSentAt: new Date(),
            createdAt: new Date('2026-02-24T18:00:00.000Z'),
            checkIn: new Date('2026-03-10T00:00:00.000Z'),
            checkOut: new Date('2026-03-12T00:00:00.000Z'),
            totalPrice: 450,
            adults: 2,
            children: 0,
            childrenAges: null,
            guest: { name: 'Hospede', email: 'guest@example.com', phone: '19999999999' },
            roomType: { name: 'Apartamento' },
            payment: { status: 'PENDING', method: 'PIX', installments: null },
        });

        const response = await POST(assistRequest(), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        expect(response.status).toBe(429);
        expect(sendBookingPendingEmail).not.toHaveBeenCalled();
    });

    it('abre o WhatsApp mesmo quando o e-mail está no cooldown', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'PENDING',
            pendingEmailSentAt: new Date(),
            createdAt: new Date('2026-02-24T18:00:00.000Z'),
            checkIn: new Date('2026-08-10T00:00:00.000Z'),
            checkOut: new Date('2026-08-12T00:00:00.000Z'),
            totalPrice: 450,
            adults: 2,
            children: 0,
            childrenAges: null,
            guest: { name: 'Hospede', email: 'guest@example.com', phone: '19999999999' },
            roomType: { name: 'Apartamento' },
            payment: { status: 'PENDING', method: 'PIX', installments: null },
        });

        const response = await POST(assistRequest({
            channels: { email: true, whatsapp: true },
        }), { params: Promise.resolve({ bookingId: 'booking-1' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.emailSkippedCooldown).toBe(true);
        expect(data.whatsappUrl).toContain('wa.me/5519999999999');
        expect(sendBookingPendingEmail).not.toHaveBeenCalled();
    });

    it('returns 502 when email sending fails', async () => {
        (sendBookingPendingEmail as any).mockResolvedValue({ success: false });

        const response = await POST(assistRequest(), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        expect(response.status).toBe(502);
    });

    it('prepara WhatsApp com cupom sem disparar o e-mail', async () => {
        (prisma.coupon.findFirst as any).mockResolvedValue({
            id: 'coupon-1',
            active: true,
            startsAt: null,
            endsAt: new Date('2026-12-01T00:00:00.000Z'),
            maxGlobalUses: null,
            bindEmail: null,
            bindPhone: null,
            type: 'PERCENT',
            value: 10,
        });

        const response = await POST(assistRequest({
            channels: { email: false, whatsapp: true },
            couponCode: 'VOLTA10',
        }), { params: Promise.resolve({ bookingId: 'booking-1' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(decodeURIComponent(data.whatsappUrl)).toContain('cupom *VOLTA10*');
        expect(sendBookingPendingEmail).not.toHaveBeenCalled();
        expect(prisma.booking.update).not.toHaveBeenCalled();
    });
});
