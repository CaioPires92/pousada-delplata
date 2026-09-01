import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { GET } from './route';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        booking: {
            findMany: vi.fn(),
        },
        $queryRawUnsafe: vi.fn(),
    },
}));

vi.mock('@/lib/expire-stale-bookings', () => ({
    expireStalePendingBookings: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin bookings API /api/admin/bookings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (requireAdminAuth as any).mockResolvedValue({ adminId: 'admin-1', email: 'admin@example.com' });
        (prisma.booking.findMany as any).mockResolvedValue([]);
    });

    it('normalizes whitespace in list filters', async () => {
        const response = await GET(new Request('http://localhost/api/admin/bookings?status= confirmed &dateField= createdAt &limit= 20 &cursor= booking-1 '));

        expect(response.status).toBe(200);
        expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: 'CONFIRMED', createdAt: undefined },
            take: 20,
            cursor: { id: 'booking-1' },
            skip: 1,
        }));
    });

    it('normalizes text fields in the returned bookings payload', async () => {
        (prisma.booking.findMany as any).mockResolvedValue([{
            id: ' booking-1 ',
            adults: 2,
            children: 0,
            childrenAges: ' 4,7 ',
            checkIn: new Date('2026-08-27T00:00:00.000Z'),
            checkOut: new Date('2026-08-28T00:00:00.000Z'),
            totalPrice: 300,
            status: ' confirmed ',
            funnelStage: ' payment_link_created ',
            funnelUpdatedAt: null,
            lastErrorMessage: '  algo deu errado  ',
            createdAt: new Date('2026-08-26T00:00:00.000Z'),
            guest: {
                name: '  Maria  ',
                email: '  maria@example.com  ',
                phone: '  11999999999  ',
            },
            roomType: {
                name: '  Chalé  ',
            },
            payment: {
                status: ' approved ',
                amount: 300,
                totalAmount: 300,
                remainingAmount: null,
                paymentMode: 'FULL',
                balanceDueAt: null,
                balanceDueDate: null,
                method: 'PIX',
                cardBrand: null,
                installments: null,
                provider: 'Mercado Pago',
            },
        }]);

        const response = await GET(new Request('http://localhost/api/admin/bookings?limit=1'));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data[0]).toMatchObject({
            id: 'booking-1',
            status: 'confirmed',
            funnelStage: 'payment_link_created',
            lastErrorMessage: 'algo deu errado',
            guest: {
                name: 'Maria',
                email: 'maria@example.com',
                phone: '11999999999',
            },
            roomType: {
                name: 'Chalé',
            },
            payment: {
                status: 'approved',
                method: 'PIX',
                provider: 'Mercado Pago',
            },
        });
    });

    it('returns the auth response when unauthorized', async () => {
        (requireAdminAuth as any).mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));

        const response = await GET(new Request('http://localhost/api/admin/bookings'));

        expect(response.status).toBe(401);
    });
});
