import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));

import { POST } from './route';

function bookingRequest(email: string) {
    return new Request('https://www.pousadadelplata.com.br/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomTypeId: 'room-1',
            checkIn: '2026-12-10',
            checkOut: '2026-12-12',
            adults: 2,
            guest: { name: 'Maria Silva', email, phone: '11999990000' },
        }),
    });
}

describe('POST /api/bookings — e-mail do hóspede', () => {
    it.each(['pepeke@pepeke', 'maria@', 'maria@gmail..com'])('recusa %s antes de tocar no banco', async (email) => {
        const response = await POST(bookingRequest(email) as any);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'guest_email_invalid' });
    });
});
