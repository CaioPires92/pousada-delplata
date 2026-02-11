import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { releaseCouponReservation } from '@/lib/coupons/reservation';

vi.mock('@/lib/coupons/reservation', () => ({
    releaseCouponReservation: vi.fn(),
}));

describe('POST /api/coupons/release', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 400 without reservationId', async () => {
        const req = new Request('http://localhost/api/coupons/release', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.released).toBe(false);
    });

    it('releases reservation successfully', async () => {
        (releaseCouponReservation as any).mockResolvedValue({ released: true });

        const req = new Request('http://localhost/api/coupons/release', {
            method: 'POST',
            body: JSON.stringify({
                reservationId: 'res-1',
                guest: { email: 'john@example.com' },
            }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ released: true });
        expect(releaseCouponReservation).toHaveBeenCalledWith({
            reservationId: 'res-1',
            guestEmail: 'john@example.com',
        });
    });

    it('returns 500 on service error', async () => {
        (releaseCouponReservation as any).mockRejectedValue(new Error('boom'));

        const req = new Request('http://localhost/api/coupons/release', {
            method: 'POST',
            body: JSON.stringify({ reservationId: 'res-1' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.released).toBe(false);
    });
});
