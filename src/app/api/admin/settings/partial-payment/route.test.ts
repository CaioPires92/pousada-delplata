import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { GET, PUT } from './route';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        partialPaymentSettings: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

describe('/api/admin/settings/partial-payment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (requireAdminAuth as any).mockResolvedValue({ adminId: 'admin-1', email: 'admin@example.com', role: 'admin' });
    });

    it('blocks unauthenticated access', async () => {
        (requireAdminAuth as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        );

        const response = await GET();

        expect(response.status).toBe(401);
        expect(prisma.partialPaymentSettings.findUnique).not.toHaveBeenCalled();
    });

    it('returns default settings when none were saved', async () => {
        (prisma.partialPaymentSettings.findUnique as any).mockResolvedValue(null);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.settings.enabled).toBe(false);
        expect(data.settings.percentage).toBe(50);
        expect(data.settings.defaultPaymentMode).toBe('FULL');
    });

    it('rejects invalid percentage', async () => {
        const response = await PUT(new Request('http://localhost/api/admin/settings/partial-payment', {
            method: 'PUT',
            body: JSON.stringify({
                enabled: true,
                percentage: 100,
                balanceDueAt: 'CHECK_IN',
                defaultPaymentMode: 'FULL',
            }),
        }));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.errors.percentage).toBeTruthy();
        expect(prisma.partialPaymentSettings.upsert).not.toHaveBeenCalled();
    });

    it('saves valid settings', async () => {
        (prisma.partialPaymentSettings.upsert as any).mockResolvedValue({
            id: 'default',
            enabled: true,
            percentage: 50,
            minimumBookingAmount: 1000,
            minimumLeadTimeDays: 3,
            balanceDueAt: 'BEFORE_CHECK_IN',
            balanceDueDaysBeforeCheckIn: 2,
            defaultPaymentMode: 'PARTIAL',
        });

        const response = await PUT(new Request('http://localhost/api/admin/settings/partial-payment', {
            method: 'PUT',
            body: JSON.stringify({
                enabled: true,
                percentage: 50,
                minimumBookingAmount: 1000,
                minimumLeadTimeDays: 3,
                balanceDueAt: 'BEFORE_CHECK_IN',
                balanceDueDaysBeforeCheckIn: 2,
                defaultPaymentMode: 'PARTIAL',
            }),
        }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.settings.enabled).toBe(true);
        expect(data.settings.defaultPaymentMode).toBe('PARTIAL');
        expect(prisma.partialPaymentSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'default' },
        }));
    });
});
