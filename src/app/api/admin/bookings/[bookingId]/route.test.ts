import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1', email: 'admin@example.com', role: 'admin' })),
}));

vi.mock('@/lib/ops-log', () => ({
    opsLog: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findUnique: vi.fn(),
            delete: vi.fn(),
        },
        payment: {
            deleteMany: vi.fn(),
        },
        couponRedemption: {
            updateMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

import prisma from '@/lib/prisma';
import { DELETE } from './route';

describe('DELETE /api/admin/bookings/[bookingId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            payment: { status: 'PENDING' },
        });
        (prisma.couponRedemption.updateMany as any).mockResolvedValue({ count: 1 });
        (prisma.payment.deleteMany as any).mockResolvedValue({ count: 1 });
        (prisma.booking.delete as any).mockResolvedValue({ id: 'booking-1' });
        (prisma.$transaction as any).mockImplementation(async (operations: any[]) => Promise.all(operations));
    });

    it('deletes booking when first confirmation is present', async () => {
        const response = await DELETE(
            new Request('http://localhost/api/admin/bookings/booking-1', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ confirmDelete: true }),
            }),
            {
                params: Promise.resolve({ bookingId: 'booking-1' }),
            }
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('requires delete confirmation payload', async () => {
        const response = await DELETE(new Request('http://localhost/api/admin/bookings/booking-1', { method: 'DELETE' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        expect(response.status).toBe(400);
        expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });

    it('requires second confirmation when payment is approved', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            payment: { status: 'APPROVED', provider: 'MERCADOPAGO', method: 'PIX', providerId: '123' },
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/bookings/booking-1', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ confirmDelete: true }),
            }),
            {
                params: Promise.resolve({ bookingId: 'booking-1' }),
            }
        );

        expect(response.status).toBe(409);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deletes approved booking when both confirmations are present', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            payment: { status: 'APPROVED', provider: 'MERCADOPAGO', method: 'PIX', providerId: '123' },
        });

        const response = await DELETE(
            new Request('http://localhost/api/admin/bookings/booking-1', {
                method: 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ confirmDelete: true, confirmApprovedDelete: true }),
            }),
            {
                params: Promise.resolve({ bookingId: 'booking-1' }),
            }
        );

        expect(response.status).toBe(200);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
});
