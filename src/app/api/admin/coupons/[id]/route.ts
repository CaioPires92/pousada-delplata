import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import {
    getCouponCodePrefix,
    hashCouponCode,
    normalizeCouponCode,
    normalizeGuestEmail,
    normalizeGuestPhone,
} from '@/lib/coupons/hash';

function parseDate(value: unknown): Date | null {
    if (!value) return null;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d;
}

function parseNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function parseIntNullable(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number.parseInt(String(value), 10);
    return Number.isFinite(n) ? n : null;
}

function parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v || '').trim()).filter(Boolean);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { id } = await params;
        const body = await request.json();

        const current = await prisma.coupon.findUnique({ where: { id } });
        if (!current) return NextResponse.json({ error: 'Cupom nao encontrado' }, { status: 404 });

        const name = String(body?.name || '').trim();
        const type = String(body?.type || '').trim().toUpperCase();
        const value = parseNumber(body?.value);

        if (!name) return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 });
        if (type !== 'PERCENT' && type !== 'FIXED') {
            return NextResponse.json({ error: 'Tipo invalido' }, { status: 400 });
        }
        if (value === null || value <= 0) {
            return NextResponse.json({ error: 'Valor invalido' }, { status: 400 });
        }
        if (type === 'PERCENT' && value > 100) {
            return NextResponse.json({ error: 'Percentual deve ser <= 100' }, { status: 400 });
        }

        const codeInput = normalizeCouponCode(String(body?.code || ''));
        let codeHash: string | undefined;
        let codePrefix: string | undefined;

        if (codeInput) {
            codeHash = hashCouponCode(codeInput);
            const existing = await prisma.coupon.findFirst({
                where: {
                    codeHash,
                    NOT: { id },
                },
            });
            if (existing) {
                return NextResponse.json({ error: 'Codigo ja existe' }, { status: 409 });
            }
            codePrefix = getCouponCodePrefix(codeInput);
        }

        const maxDiscountAmount = parseNumber(body?.maxDiscountAmount);
        const minBookingValue = parseNumber(body?.minBookingValue);
        const maxGlobalUses = parseIntNullable(body?.maxGlobalUses);
        const maxUsesPerGuest = parseIntNullable(body?.maxUsesPerGuest);
        const startsAt = parseDate(body?.startsAt);
        const endsAt = parseDate(body?.endsAt);

        if (startsAt && endsAt && startsAt > endsAt) {
            return NextResponse.json({ error: 'Periodo invalido' }, { status: 400 });
        }

        const allowedRoomTypeIds = parseStringArray(body?.allowedRoomTypeIds);
        const allowedSources = parseStringArray(body?.allowedSources).map((s) => s.toLowerCase());

        const updated = await prisma.coupon.update({
            where: { id },
            data: {
                name,
                ...(codeHash ? { codeHash, codePrefix } : {}),
                type,
                value,
                maxDiscountAmount,
                minBookingValue,
                active: body?.active !== undefined ? Boolean(body.active) : current.active,
                startsAt,
                endsAt,
                maxGlobalUses,
                maxUsesPerGuest,
                bindEmail: normalizeGuestEmail(body?.bindEmail) || null,
                bindPhone: normalizeGuestPhone(body?.bindPhone) || null,
                allowedRoomTypeIds: allowedRoomTypeIds.length ? JSON.stringify(allowedRoomTypeIds) : null,
                allowedSources: allowedSources.length ? JSON.stringify(allowedSources) : null,
                singleUse: body?.singleUse !== undefined ? Boolean(body.singleUse) : current.singleUse,
                stackable: body?.stackable !== undefined ? Boolean(body.stackable) : current.stackable,
            },
        });

        return NextResponse.json({ coupon: updated }, { status: 200 });
    } catch (error) {
        console.error('[Admin Coupons] PUT error:', error);
        return NextResponse.json({ error: 'Erro ao atualizar cupom' }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const { id } = await params;

        const updated = await prisma.coupon.update({
            where: { id },
            data: {
                active: false,
                endsAt: new Date(),
            },
        });

        return NextResponse.json({ coupon: updated }, { status: 200 });
    } catch (error) {
        console.error('[Admin Coupons] DELETE error:', error);
        return NextResponse.json({ error: 'Erro ao desativar cupom' }, { status: 500 });
    }
}
