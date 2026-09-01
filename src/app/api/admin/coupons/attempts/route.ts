import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { asNullableString } from '@/lib/requestValue';

function parseLimit(raw: string | null) {
    const n = Number.parseInt(asNullableString(raw) ?? '', 10);
    if (!Number.isFinite(n) || n <= 0) return 50;
    return Math.min(n, 200);
}

export async function GET(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { searchParams } = new URL(request.url);
        const limit = parseLimit(searchParams.get('limit'));
        const result = (asNullableString(searchParams.get('result')) ?? '').toUpperCase();
        const reason = (asNullableString(searchParams.get('reason')) ?? '').toUpperCase();
        const codePrefix = (asNullableString(searchParams.get('codePrefix')) ?? '').toUpperCase();
        const days = Number.parseInt(asNullableString(searchParams.get('days')) ?? '', 10);

        const where: any = {};

        if (result) where.result = result;
        if (reason) where.reason = reason;
        if (codePrefix) where.codePrefix = { startsWith: codePrefix };

        if (Number.isFinite(days) && days > 0) {
            where.createdAt = {
                gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
            };
        }

        const attempts = await prisma.couponAttemptLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                coupon: {
                    select: {
                        id: true,
                        name: true,
                        codePrefix: true,
                    },
                },
            },
        });

        return NextResponse.json({ attempts, total: attempts.length });
    } catch (error) {
        console.error('[Admin Coupon Attempts] GET error:', error);
        return NextResponse.json({ error: 'Erro ao carregar tentativas' }, { status: 500 });
    }
}
