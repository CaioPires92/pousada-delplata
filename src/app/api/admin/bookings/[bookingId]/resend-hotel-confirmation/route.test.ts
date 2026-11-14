import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { sendBookingGuestConfirmationEmail, sendBookingStatusAlertEmail } from '@/lib/booking-status-alert';
import { POST } from './route';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1' })),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

vi.mock('@/lib/booking-status-alert', () => ({
    sendBookingGuestConfirmationEmail: vi.fn(),
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

describe('POST resend booking confirmation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (sendBookingGuestConfirmationEmail as any).mockResolvedValue({
            success: true,
            messageId: 'guest-mail-123',
        });
        (sendBookingStatusAlertEmail as any).mockResolvedValue({
            success: true,
            messageId: 'hotel-mail-123',
        });
    });

    it('sends the voucher to the guest and confirmation to the hotel', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(confirmedBooking);

        const response = await POST(
            new Request('https://example.com', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: ' booking-1 ' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toMatchObject({ bookingId: 'booking-1', guestSent: true, hotelSent: true });
        expect(sendBookingGuestConfirmationEmail).toHaveBeenCalledWith(
            confirmedBooking,
            { bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED' }
        );
        expect(sendBookingStatusAlertEmail).toHaveBeenCalledWith(
            confirmedBooking,
            { bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED' }
        );
        expect(prisma.booking.updateMany).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: { confirmationEmailSentAt: expect.any(Date) },
        });
    });

    it('reports a partial failure without hiding the successful send', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(confirmedBooking);
        (sendBookingGuestConfirmationEmail as any).mockResolvedValue({
            success: false,
            error: new Error('guest failed'),
        });

        const response = await POST(
            new Request('https://example.com', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: 'booking-1' }) }
        );
        const data = await response.json();

        expect(response.status).toBe(502);
        expect(data).toMatchObject({ guestSent: false, hotelSent: true });
        expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });

    it('blocks a booking that is not confirmed', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            ...confirmedBooking,
            status: 'PENDING',
        });

        const response = await POST(
            new Request('https://example.com', { method: 'POST' }),
            { params: Promise.resolve({ bookingId: 'booking-1' }) }
        );

        expect(response.status).toBe(409);
        expect(sendBookingGuestConfirmationEmail).not.toHaveBeenCalled();
        expect(sendBookingStatusAlertEmail).not.toHaveBeenCalled();
    });
});
