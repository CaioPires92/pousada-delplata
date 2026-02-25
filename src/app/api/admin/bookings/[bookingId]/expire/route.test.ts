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
    },
}));

import prisma from '@/lib/prisma';
import { POST } from './route';

describe('POST /api/admin/bookings/[bookingId]/expire', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'PENDING',
            payment: { status: 'PENDING' },
        });
        (prisma.booking.update as any).mockResolvedValue({ id: 'booking-1', status: 'EXPIRED' });
    });

    it('expires pending booking', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/expire', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(prisma.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: { status: 'EXPIRED' },
        });
    });

    it('blocks when payment is approved', async () => {
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            status: 'CONFIRMED',
            payment: { status: 'APPROVED' },
        });

        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/expire', { method: 'POST' }), {
            params: Promise.resolve({ bookingId: 'booking-1' }),
        });

        expect(response.status).toBe(409);
        expect(prisma.booking.update).not.toHaveBeenCalled();
    });
});
