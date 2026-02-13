import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';

function daysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const since7d = daysAgo(7);
        const since30d = daysAgo(30);

        const [
            totalCoupons,
            activeCoupons,
            reservedCount,
            confirmedCount,
            releasedCount,
            invalidAttempts7d,
            blockedAttempts7d,
            validAttempts7d,
            invalidAttempts30d,
            blockedAttempts30d,
            validAttempts30d,
        ] = await Promise.all([
            prisma.coupon.count(),
            prisma.coupon.count({ where: { active: true } }),
            prisma.couponRedemption.count({ where: { status: 'RESERVED' } }),
            prisma.couponRedemption.count({ where: { status: 'CONFIRMED' } }),
            prisma.couponRedemption.count({ where: { status: 'RELEASED' } }),
            prisma.couponAttemptLog.count({ where: { result: 'INVALID', createdAt: { gte: since7d } } }),
            prisma.couponAttemptLog.count({ where: { result: 'BLOCKED', createdAt: { gte: since7d } } }),
            prisma.couponAttemptLog.count({ where: { result: 'VALID', createdAt: { gte: since7d } } }),
            prisma.couponAttemptLog.count({ where: { result: 'INVALID', createdAt: { gte: since30d } } }),
            prisma.couponAttemptLog.count({ where: { result: 'BLOCKED', createdAt: { gte: since30d } } }),
            prisma.couponAttemptLog.count({ where: { result: 'VALID', createdAt: { gte: since30d } } }),
        ]);

        return NextResponse.json({
            inventory: {
                totalCoupons,
                activeCoupons,
            },
            redemptions: {
                reserved: reservedCount,
                confirmed: confirmedCount,
                released: releasedCount,
            },
            attempts: {
                last7d: {
                    invalid: invalidAttempts7d,
                    blocked: blockedAttempts7d,
                    valid: validAttempts7d,
                },
                last30d: {
                    invalid: invalidAttempts30d,
                    blocked: blockedAttempts30d,
                    valid: validAttempts30d,
                },
            },
        });
    } catch (error) {
        console.error('[Admin Coupon Metrics] GET error:', error);
        return NextResponse.json({ error: 'Erro ao carregar metricas de cupom' }, { status: 500 });
    }
}
