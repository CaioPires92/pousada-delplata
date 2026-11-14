// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: 'smtp-message-id' }));

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
    },
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

vi.mock('@/lib/booking-access', () => ({
    authorizeBookingRequest: vi.fn(),
}));

vi.mock('@/lib/booking-status-alert', () => ({
    sendBookingGuestConfirmationEmail: vi.fn(),
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { authorizeBookingRequest } from '@/lib/booking-access';
import { sendBookingGuestConfirmationEmail } from '@/lib/booking-status-alert';
import { POST } from './route';

const confirmedBooking = {
    id: 'booking-1',
    status: 'CONFIRMED',
    confirmationEmailSentAt: new Date('2026-11-01T12:00:00.000Z'),
    checkIn: new Date('2026-12-10T00:00:00.000Z'),
    checkOut: new Date('2026-12-12T00:00:00.000Z'),
    totalPrice: 1200,
    adults: 2,
    children: 0,
    childrenAges: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    guest: {
        name: 'Hóspede da reserva',
        email: 'persisted@example.com',
        phone: '5511999999999',
    },
    roomType: { name: 'Chalé' },
    payment: {
        status: 'APPROVED',
        method: 'CREDIT_CARD',
        installments: 2,
        paymentMode: 'FULL',
        amount: 1200,
        remainingAmount: 0,
        balanceDueAt: null,
        balanceDueDate: null,
    },
};

let requestSequence = 0;

function buildRequest(body: Record<string, unknown>) {
    requestSequence += 1;
    return new Request('https://example.com/api/emails/send-confirmation', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-forwarded-for': `198.51.100.${requestSequence}`,
        },
        body: JSON.stringify(body),
    });
}

describe('POST /api/emails/send-confirmation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'));
        (authorizeBookingRequest as any).mockResolvedValue({ authorized: true, token: 'valid-token' });
        (prisma.booking.findUnique as any).mockResolvedValue(confirmedBooking);
        (prisma.booking.updateMany as any).mockResolvedValue({ count: 1 });
        (sendBookingGuestConfirmationEmail as any).mockResolvedValue({ success: true, messageId: 'mail-1' });
    });

    it('sends a legitimate confirmation using only persisted booking data', async () => {
        const response = await POST(buildRequest({ bookingId: 'booking-1' }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ success: true });
        expect(sendBookingGuestConfirmationEmail).toHaveBeenCalledWith(
            confirmedBooking,
            { bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED' }
        );
        expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('rejects a request without booking authorization before reading the booking', async () => {
        (authorizeBookingRequest as any).mockResolvedValue({ authorized: false, token: null });

        const response = await POST(buildRequest({ bookingId: 'booking-1' }));

        expect(response.status).toBe(404);
        expect(prisma.booking.findUnique).not.toHaveBeenCalled();
        expect(sendBookingGuestConfirmationEmail).not.toHaveBeenCalled();
    });

    it('does not send for a nonexistent booking', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue(null);

        const response = await POST(buildRequest({ bookingId: 'missing-booking' }));

        expect(response.status).toBe(404);
        expect(sendBookingGuestConfirmationEmail).not.toHaveBeenCalled();
    });

    it('rejects an attempt to override the persisted recipient', async () => {
        const response = await POST(buildRequest({
            bookingId: 'booking-1',
            email: 'attacker@example.net',
        }));

        expect(response.status).toBe(400);
        expect(prisma.booking.findUnique).not.toHaveBeenCalled();
        expect(sendBookingGuestConfirmationEmail).not.toHaveBeenCalled();
    });

    it('blocks a repeated send inside the cooldown window', async () => {
        (prisma.booking.updateMany as any).mockResolvedValue({ count: 0 });

        const response = await POST(buildRequest({ bookingId: 'booking-1' }));

        expect(response.status).toBe(429);
        expect(sendBookingGuestConfirmationEmail).not.toHaveBeenCalled();
    });

    it('rolls back the send claim and returns a sanitized error when SMTP fails', async () => {
        (sendBookingGuestConfirmationEmail as any).mockResolvedValue({
            success: false,
            error: new Error('SMTP host rejected persisted@example.com'),
        });

        const response = await POST(buildRequest({ bookingId: 'booking-1' }));
        const data = await response.json();

        expect(response.status).toBe(502);
        expect(data).toEqual({ error: 'BOOKING_CONFIRMATION_EMAIL_FAILED' });
        expect(prisma.booking.updateMany).toHaveBeenCalledTimes(2);
        expect(prisma.booking.updateMany).toHaveBeenLastCalledWith({
            where: {
                id: 'booking-1',
                confirmationEmailSentAt: expect.any(Date),
            },
            data: { confirmationEmailSentAt: confirmedBooking.confirmationEmailSentAt },
        });
        expect(JSON.stringify(data)).not.toContain('persisted@example.com');
        expect(JSON.stringify(data)).not.toContain('SMTP host');
    });
});
