import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { parsePromotionInput } from '@/lib/promotions/validation';

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
        return NextResponse.json(promotions);
    } catch (error) {
        console.error('[Admin Promotions] GET error:', error);
        return NextResponse.json({ error: 'Erro ao carregar promoções' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const parsed = parsePromotionInput(await request.json());
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

        const promotion = await prisma.promotion.create({ data: { ...parsed.data, type: 'CUSTOM' } });
        return NextResponse.json(promotion, { status: 201 });
    } catch (error) {
        console.error('[Admin Promotions] POST error:', error);
        return NextResponse.json({ error: 'Erro ao salvar promoção' }, { status: 500 });
    }
}
