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
            update: vi.fn(),
        },
        couponRedemption: {
            updateMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

import prisma from '@/lib/prisma';
import { POST } from './route';

describe('POST /api/admin/bookings/[bookingId]/confirm', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'PENDING',
        });
        (prisma.booking.update as any).mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });
        (prisma.couponRedemption.updateMany as any).mockResolvedValue({ count: 1 });
        (prisma.$transaction as any).mockImplementation(async (operations: any[]) => Promise.all(operations));
    });

    it('confirma reserva pendente', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/confirm', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(prisma.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: { status: 'CONFIRMED' },
        });
        expect(prisma.couponRedemption.updateMany).toHaveBeenCalledWith({
            where: { bookingId: 'booking-1', status: 'RESERVED' },
            data: {
                status: 'CONFIRMED',
                confirmedAt: expect.any(Date),
                bookingId: 'booking-1',
            },
        });
    });

    it('retorna sucesso quando reserva ja esta confirmada', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'CONFIRMED',
        });

        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/confirm', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.alreadyConfirmed).toBe(true);
        expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('bloqueia confirmacao de reserva cancelada', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'CANCELLED',
        });

        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/confirm', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        expect(response.status).toBe(409);
        expect(prisma.booking.update).not.toHaveBeenCalled();
    });
});
