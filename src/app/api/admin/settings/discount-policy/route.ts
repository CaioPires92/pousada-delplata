import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import {
    normalizeDiscountPolicy,
    validateDiscountPolicy,
} from '@/lib/discount-policy';
import {
    DISCOUNT_POLICY_ID,
    getDiscountPolicy,
} from '@/lib/discount-policy-store';

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;
        return NextResponse.json({ policy: await getDiscountPolicy() });
    } catch (error) {
        console.error('[Discount Policy] GET error:', error);
        return NextResponse.json({ error: 'Erro ao carregar a política de desconto.' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const policy = normalizeDiscountPolicy(body);
        const validation = validateDiscountPolicy(policy);
        if (!validation.valid) {
            return NextResponse.json(
                { error: 'Política de desconto inválida.', errors: validation.errors },
                { status: 400 }
            );
        }

        await prisma.discountPolicySettings.upsert({
            where: { id: DISCOUNT_POLICY_ID },
            update: {
                sendEnabled: policy.sendEnabled,
                percentage: policy.percentage,
                validityDays: policy.validityDays,
                minimumBookingValue: policy.minimumBookingValue,
                maximumDiscountAmount: policy.maximumDiscountAmount,
                blockedDateRanges: JSON.stringify(policy.blockedDateRanges),
            },
            create: {
                id: DISCOUNT_POLICY_ID,
                sendEnabled: policy.sendEnabled,
                percentage: policy.percentage,
                validityDays: policy.validityDays,
                minimumBookingValue: policy.minimumBookingValue,
                maximumDiscountAmount: policy.maximumDiscountAmount,
                blockedDateRanges: JSON.stringify(policy.blockedDateRanges),
            },
        });

        console.info('[Discount Policy] updated', {
            adminId: 'adminId' in auth ? auth.adminId : null,
            sendEnabled: policy.sendEnabled,
            percentage: policy.percentage,
            blockedRanges: policy.blockedDateRanges.length,
        });
        return NextResponse.json({ policy });
    } catch (error) {
        console.error('[Discount Policy] PUT error:', error);
        return NextResponse.json({ error: 'Erro ao salvar a política de desconto.' }, { status: 500 });
    }
}
