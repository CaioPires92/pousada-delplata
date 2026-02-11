import { NextResponse } from 'next/server';
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

function generateCouponCode(len = 10): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i += 1) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const coupons = await prisma.coupon.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        redemptions: true,
                        attemptLogs: true,
                    },
                },
            },
        });

        return NextResponse.json(coupons);
    } catch (error) {
        console.error('[Admin Coupons] GET error:', error);
        return NextResponse.json({ error: 'Erro ao carregar cupons' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json();

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

        const shouldGenerate = Boolean(body?.generateCode);
        const providedCode = normalizeCouponCode(String(body?.code || ''));
        const createdCode = shouldGenerate || !providedCode ? generateCouponCode() : providedCode;
        const code = normalizeCouponCode(createdCode);

        if (!code) {
            return NextResponse.json({ error: 'Codigo invalido' }, { status: 400 });
        }

        const codeHash = hashCouponCode(code);
        const existing = await prisma.coupon.findFirst({ where: { codeHash } });
        if (existing) {
            return NextResponse.json({ error: 'Codigo ja existe' }, { status: 409 });
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

        const coupon = await prisma.coupon.create({
            data: {
                name,
                codeHash,
                codePrefix: getCouponCodePrefix(code),
                type,
                value,
                maxDiscountAmount,
                minBookingValue,
                active: body?.active !== undefined ? Boolean(body.active) : true,
                startsAt,
                endsAt,
                maxGlobalUses,
                maxUsesPerGuest,
                bindEmail: normalizeGuestEmail(body?.bindEmail) || null,
                bindPhone: normalizeGuestPhone(body?.bindPhone) || null,
                allowedRoomTypeIds: allowedRoomTypeIds.length ? JSON.stringify(allowedRoomTypeIds) : null,
                allowedSources: allowedSources.length ? JSON.stringify(allowedSources) : null,
                singleUse: body?.singleUse !== undefined ? Boolean(body.singleUse) : true,
                stackable: body?.stackable !== undefined ? Boolean(body.stackable) : false,
            },
        });

        return NextResponse.json({ coupon, createdCode: code }, { status: 201 });
    } catch (error) {
        console.error('[Admin Coupons] POST error:', error);
        return NextResponse.json({ error: 'Erro ao criar cupom' }, { status: 500 });
    }
}
