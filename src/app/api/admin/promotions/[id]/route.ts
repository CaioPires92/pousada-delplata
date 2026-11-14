import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import { parsePromotionInput } from '@/lib/promotions/validation';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { id } = await params;
        const current = await prisma.promotion.findUnique({ where: { id } });
        if (!current) return NextResponse.json({ error: 'Promoção não encontrada' }, { status: 404 });

        const parsed = parsePromotionInput(await request.json());
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

        const promotion = await prisma.promotion.update({ where: { id }, data: parsed.data });
        return NextResponse.json(promotion);
    } catch (error) {
        console.error('[Admin Promotions] PUT error:', error);
        return NextResponse.json({ error: 'Erro ao atualizar promoção' }, { status: 500 });
    }
}

/** Ativar/desativar sem reenviar o formulário inteiro. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { id } = await params;
        const body = await request.json();
        if (typeof body?.active !== 'boolean') {
            return NextResponse.json({ error: 'Campo "active" (boolean) obrigatório' }, { status: 400 });
        }

        const current = await prisma.promotion.findUnique({ where: { id } });
        if (!current) return NextResponse.json({ error: 'Promoção não encontrada' }, { status: 404 });

        const promotion = await prisma.promotion.update({ where: { id }, data: { active: body.active } });
        return NextResponse.json(promotion);
    } catch (error) {
        console.error('[Admin Promotions] PATCH error:', error);
        return NextResponse.json({ error: 'Erro ao atualizar promoção' }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { id } = await params;
        const current = await prisma.promotion.findUnique({ where: { id } });
        if (!current) return NextResponse.json({ error: 'Promoção não encontrada' }, { status: 404 });

        // Reservas antigas mantêm o snapshot (promotionName/promotionDiscount), então excluir é seguro.
        await prisma.promotion.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Admin Promotions] DELETE error:', error);
        return NextResponse.json({ error: 'Erro ao excluir promoção' }, { status: 500 });
    }
}
