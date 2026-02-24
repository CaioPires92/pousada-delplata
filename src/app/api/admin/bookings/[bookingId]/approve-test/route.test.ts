import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1', email: 'admin@example.com', role: 'admin' })),
}));

vi.mock('@/lib/ga4-measurement', () => ({
    sendGa4PurchaseServerEvent: vi.fn(async () => ({ ok: true, status: 204 })),
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        payment: {
            upsert: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

import prisma from '@/lib/prisma';
import { sendGa4PurchaseServerEvent } from '@/lib/ga4-measurement';
import { POST } from './route';

describe('POST /api/admin/bookings/[bookingId]/approve-test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ENABLE_TEST_PAYMENTS = 'true';

        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            guestId: 'guest-1',
            roomTypeId: 'room-1',
            totalPrice: 2.99,
            status: 'PENDING',
            payment: { status: 'PENDING' },
            guest: { id: 'guest-1' },
            roomType: { id: 'room-1', name: 'Apartamento' },
        });

        (prisma.payment.upsert as any).mockResolvedValue({ id: 'payment-1' });
        (prisma.booking.update as any).mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });
        (prisma.$transaction as any).mockImplementation(async (operations: any[]) => Promise.all(operations));
    });

    it('returns 403 when test payments are disabled', async () => {
        process.env.ENABLE_TEST_PAYMENTS = 'false';

        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/approve-test', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        expect(response.status).toBe(403);
        expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });

    it('approves payment and sends GA4 server purchase event', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/approve-test', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.transactionId).toMatch(/^TEST_booking-1_/);
        expect(prisma.payment.upsert).toHaveBeenCalled();
        expect(prisma.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: { status: 'CONFIRMED' },
        });
        expect(sendGa4PurchaseServerEvent).toHaveBeenCalledTimes(1);
    });
});
