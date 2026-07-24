import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: vi.fn(async () => ({ adminId: 'admin-1' })),
}));

vi.mock('@/lib/ops-log', () => ({ opsLog: vi.fn() }));
vi.mock('@/lib/discount-policy-store', () => ({
    getDiscountPolicy: vi.fn(async () => ({
        sendEnabled: true,
        percentage: 10,
        validityDays: 7,
        minimumBookingValue: null,
        maximumDiscountAmount: null,
        blockedDateRanges: [],
    })),
}));
vi.mock('@/lib/email', () => ({
    sendGuestDiscountEmail: vi.fn(async () => ({ success: true, messageId: 'message-1' })),
}));
vi.mock('@/lib/prisma', () => ({
    default: {
        booking: { findUnique: vi.fn() },
        coupon: { create: vi.fn(), update: vi.fn() },
    },
}));

import prisma from '@/lib/prisma';
import { sendGuestDiscountEmail } from '@/lib/email';
import { getDiscountPolicy } from '@/lib/discount-policy-store';
import { POST } from './route';

describe('POST /api/admin/bookings/[bookingId]/discount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.booking.findUnique as any).mockResolvedValue({
            id: 'booking-1',
            guest: {
                name: 'Maria Silva',
                email: 'Maria@Example.com',
                phone: '(19) 99999-9999',
            },
        });
        (prisma.coupon.create as any).mockResolvedValue({ id: 'coupon-1' });
    });

    it('creates a guest-bound, one-use 10% coupon and prepares both channels', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/discount', {
            method: 'POST',
            body: JSON.stringify({ channels: { email: true, whatsapp: true } }),
        }), { params: Promise.resolve({ bookingId: 'booking-1' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.code).toMatch(/^VOLTE-[A-Z2-9]{8}$/);
        expect(data.whatsappUrl).toContain('wa.me/5519999999999');
        expect(prisma.coupon.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'PERCENT',
                value: 10,
                maxGlobalUses: 1,
                maxUsesPerGuest: 1,
                bindEmail: 'maria@example.com',
                bindPhone: '19999999999',
                singleUse: true,
                stackable: false,
            }),
        });
        expect(sendGuestDiscountEmail).toHaveBeenCalledTimes(1);
    });

    it('rejects requests without a delivery channel', async () => {
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/discount', {
            method: 'POST',
            body: JSON.stringify({ channels: { email: false, whatsapp: false } }),
        }), { params: Promise.resolve({ bookingId: 'booking-1' }) });

        expect(response.status).toBe(400);
        expect(prisma.coupon.create).not.toHaveBeenCalled();
    });

    it('does not create a coupon while sending is paused', async () => {
        (getDiscountPolicy as any).mockResolvedValueOnce({
            sendEnabled: false,
            percentage: 10,
            validityDays: 7,
            minimumBookingValue: null,
            maximumDiscountAmount: null,
            blockedDateRanges: [],
        });
        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/discount', {
            method: 'POST',
            body: JSON.stringify({ channels: { email: true, whatsapp: false } }),
        }), { params: Promise.resolve({ bookingId: 'booking-1' }) });

        expect(response.status).toBe(409);
        expect(prisma.coupon.create).not.toHaveBeenCalled();
    });

    it('deactivates the coupon when automatic email delivery fails', async () => {
        (sendGuestDiscountEmail as any).mockResolvedValueOnce({ success: false });
        (prisma.coupon.update as any).mockResolvedValue({ id: 'coupon-1', active: false });

        const response = await POST(new Request('http://localhost/api/admin/bookings/booking-1/discount', {
            method: 'POST',
            body: JSON.stringify({ channels: { email: true, whatsapp: false } }),
        }), { params: Promise.resolve({ bookingId: 'booking-1' }) });

        expect(response.status).toBe(502);
        expect(prisma.coupon.update).toHaveBeenCalledWith({
            where: { id: 'coupon-1' },
            data: { active: false },
        });
    });
});
