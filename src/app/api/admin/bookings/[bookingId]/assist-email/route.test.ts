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
    },
}));

import prisma from '@/lib/prisma';
import { sendBookingPendingEmail } from '@/lib/email';
import { POST } from './route';

describe('POST /api/admin/bookings/[bookingId]/assist-email', () => {
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
        const response = await POST(
            new Request('http://localhost/api/admin/bookings/booking-1/assist-email', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ reason: 'Hospede pediu ajuda no WhatsApp' }),
            }),
            {
                params: Promise.resolve({ bookingId: 'booking-1' }),
            }
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(sendBookingPendingEmail).toHaveBeenCalledTimes(1);
        expect(prisma.booking.update).toHaveBeenCalledTimes(1);
    });

    it('requires reason', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/assist-email', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        expect(response.status).toBe(400);
        expect(prisma.booking.findUnique).not.toHaveBeenCalled();
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

        const response = await POST(
            new Request('http://localhost/api/admin/bookings/booking-1/assist-email', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ reason: 'Tentativa repetida' }),
            }),
            {
                params: Promise.resolve({ bookingId: 'booking-1' }),
            }
        );

        expect(response.status).toBe(429);
        expect(sendBookingPendingEmail).not.toHaveBeenCalled();
    });

    it('returns 502 when email sending fails', async () => {
        (sendBookingPendingEmail as any).mockResolvedValue({ success: false });

        const response = await POST(
            new Request('http://localhost/api/admin/bookings/booking-1/assist-email', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ reason: 'Reenvio manual' }),
            }),
            {
                params: Promise.resolve({ bookingId: 'booking-1' }),
            }
        );

        expect(response.status).toBe(502);
    });
});
