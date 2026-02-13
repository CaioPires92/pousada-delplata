import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getCouponTemplates } from '@/lib/coupons/templates';

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        return NextResponse.json({ templates: getCouponTemplates() });
    } catch (error) {
        console.error('[Admin Coupon Templates] GET error:', error);
        return NextResponse.json({ error: 'Erro ao carregar modelos de cupom' }, { status: 500 });
    }
}
