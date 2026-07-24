import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1' })),
}));
vi.mock('@/lib/discount-policy-store', () => ({
    DISCOUNT_POLICY_ID: 'default',
    getDiscountPolicy: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
    default: {
        discountPolicySettings: { upsert: vi.fn() },
    },
}));

import prisma from '@/lib/prisma';
import { PUT } from './route';

describe('PUT /api/admin/settings/discount-policy', () => {
    beforeEach(() => vi.clearAllMocks());

    it('saves a valid policy with blocked date ranges', async () => {
        (prisma.discountPolicySettings.upsert as any).mockResolvedValue({ id: 'default' });
        const response = await PUT(new Request('http://localhost/api/admin/settings/discount-policy', {
            method: 'PUT',
            body: JSON.stringify({
                sendEnabled: false,
                percentage: 12,
                validityDays: 15,
                minimumBookingValue: 500,
                maximumDiscountAmount: 250,
                blockedDateRanges: [{ start: '2026-12-30', end: '2027-01-01', label: 'Réveillon' }],
            }),
        }));
        expect(response.status).toBe(200);
        expect(prisma.discountPolicySettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                sendEnabled: false,
                percentage: 12,
                blockedDateRanges: expect.stringContaining('Réveillon'),
            }),
        }));
    });

    it('rejects an excessive percentage', async () => {
        const response = await PUT(new Request('http://localhost/api/admin/settings/discount-policy', {
            method: 'PUT',
            body: JSON.stringify({ percentage: 90, validityDays: 7 }),
        }));
        expect(response.status).toBe(400);
        expect(prisma.discountPolicySettings.upsert).not.toHaveBeenCalled();
    });
});
