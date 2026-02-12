import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { requireAdminAuth } from '@/lib/admin-auth';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(),
}));

describe('Admin Coupon Templates API /api/admin/coupons/templates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns templates when authenticated', async () => {
        (requireAdminAuth as any).mockResolvedValue({ sub: 'admin-1' });

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(Array.isArray(data.templates)).toBe(true);
        expect(data.templates).toHaveLength(4);
        expect(data.templates[0]).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
                payload: expect.any(Object),
            })
        );
    });

    it('returns auth response when unauthorized', async () => {
        (requireAdminAuth as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        );

        const res = await GET();

        expect(res.status).toBe(401);
    });
});
