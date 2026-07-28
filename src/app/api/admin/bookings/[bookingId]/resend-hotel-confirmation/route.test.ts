import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';
import { POST } from './route';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1' })),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('@/lib/booking-status-alert', () => ({
    sendBookingStatusAlertEmail: vi.fn(),
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

const confirmedBooking = {
    id: 'booking-1',
    status: 'CONFIRMED',
    checkIn: new Date('2026-12-29T00:00:00.000Z'),
    checkOut: new Date('2027-01-02T00:00:00.000Z'),
    totalPrice: 2199,
    adults: 2,
    children: 0,
    guest: {
        name: 'Edvaldo José da Silva',
        email: 'guest@example.com',
        phone: '5511999999999',
    },
    roomType: { name: 'Chalé' },
    payment: {
        status: 'APPROVED',
        method: 'CREDIT_CARD',
        installments: 6,
    },
};

describe('POST resend hotel confirmation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reenvia a confirmação de uma reserva confirmada', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(confirmedBooking);
        (sendBookingStatusAlertEmail as any).mockResolvedValue({
            success: true,
            messageId: 'mail-123',
        });

        const response = await POST(
            new Request('https://example.com', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: 'booking-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.messageId).toBe('mail-123');
        expect(sendBookingStatusAlertEmail).toHaveBeenCalledWith(
            confirmedBooking,
            { bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED' }
        );
    });

    it('bloqueia reserva ainda não confirmada', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            ...confirmedBooking,
            status: 'PENDING',
        });

        const response = await POST(
            new Request('https://example.com', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: 'booking-1' }) }
        );

        expect(response.status).toBe(409);
        expect(sendBookingStatusAlertEmail).not.toHaveBeenCalled();
    });
});
