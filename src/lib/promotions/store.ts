import prisma from '@/lib/prisma';
import { isDayKey } from '@/lib/day-key';
import { isPromotionAudience, isPromotionType, type PromotionRule, type StayDateRange } from '@/lib/promotions/engine';

type PromotionRow = {
    id: string;
    name: string;
    badgeLabel: string | null;
    type: string;
    active: boolean;
    discountPercent: unknown;
    maxDiscountAmount: unknown;
    minDaysBeforeCheckIn: number | null;
    maxDaysBeforeCheckIn: number | null;
    stayStart: Date | string | null;
    stayEnd: Date | string | null;
    excludedStayDates?: string | null;
    daysOfWeek?: string | null;
    bookableFrom: Date | string | null;
    bookableUntil: Date | string | null;
    minNights: number | null;
    allowedRoomTypeIds: string | null;
    stackWithCoupons: boolean;
    stackWithPromotions?: boolean | null;
    allowedCouponIds?: string | null;
    allowedPromotionIds?: string | null;
    exclusive: boolean;
    audience?: string | null;
    showBadge?: boolean | null;
    createdAt?: Date | string | null;
};

function toDayKey(value: Date | string | null) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

function toNumberOrNull(value: unknown) {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/** null/vazio = sem restrição (todos); lista (mesmo vazia, ex.: "[]") = só esses ids. */
export function parseNullableIdList(value: unknown): string[] | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    return parseRoomTypeIds(value);
}

/** Lê o JSON [{from,to}] das datas excluídas; ignora entradas inválidas em vez de quebrar a cotação. */
export function parseExcludedStayRanges(value: unknown): StayDateRange[] {
    if (!value) return [];
    let raw: unknown = value;
    if (typeof value === 'string') {
        try {
            raw = JSON.parse(value);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
        const entry = (item && typeof item === 'object' ? item : { from: item }) as Record<string, unknown>;
        const from = String(entry.from ?? '').slice(0, 10);
        const to = String(entry.to ?? from).slice(0, 10);
        return isDayKey(from) && isDayKey(to) && from <= to ? [{ from, to }] : [];
    });
}

/** Lê o JSON [0..6] dos dias da semana; null/vazio/inválido = todos os dias. */
export function parseDaysOfWeek(value: unknown): number[] | null {
    if (!value) return null;
    let raw: unknown = value;
    if (typeof value === 'string') {
        try {
            raw = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (!Array.isArray(raw)) return null;
    const days = Array.from(new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))).sort((a, b) => a - b);
    return days.length > 0 && days.length < 7 ? days : null;
}

export function parseRoomTypeIds(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    if (typeof value !== 'string') return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
        // cai para lista separada por vírgula
    }
    return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Converte a linha do banco em regra normalizada. Retorna null se a linha for inválida. */
export function toPromotionRule(row: PromotionRow): PromotionRule | null {
    const discountPercent = toNumberOrNull(row.discountPercent);
    if (discountPercent === null || discountPercent <= 0) return null;

    return {
        id: row.id,
        name: row.name,
        badgeLabel: row.badgeLabel,
        // Tipos legados definem só a etiqueta padrão; qualquer outro valor vira CUSTOM.
        type: isPromotionType(row.type) ? row.type : 'CUSTOM',
        active: row.active,
        discountPercent,
        maxDiscountAmount: toNumberOrNull(row.maxDiscountAmount),
        minDaysBeforeCheckIn: row.minDaysBeforeCheckIn,
        maxDaysBeforeCheckIn: row.maxDaysBeforeCheckIn,
        stayStart: toDayKey(row.stayStart),
        stayEnd: toDayKey(row.stayEnd),
        excludedStayRanges: parseExcludedStayRanges(row.excludedStayDates),
        daysOfWeek: parseDaysOfWeek(row.daysOfWeek),
        bookableFrom: toDayKey(row.bookableFrom),
        bookableUntil: toDayKey(row.bookableUntil),
        minNights: row.minNights,
        allowedRoomTypeIds: parseRoomTypeIds(row.allowedRoomTypeIds),
        stackWithCoupons: row.stackWithCoupons,
        allowedCouponIds: parseNullableIdList(row.allowedCouponIds),
        stackWithPromotions: Boolean(row.stackWithPromotions),
        allowedPromotionIds: parseNullableIdList(row.allowedPromotionIds),
        exclusive: row.exclusive,
        audience: isPromotionAudience(row.audience) ? row.audience : 'all',
        showBadge: row.showBadge !== false,
        createdAt: row.createdAt ? new Date(row.createdAt).getTime() || 0 : 0,
    };
}

export async function loadActivePromotionRules(client: Pick<typeof prisma, 'promotion'> = prisma): Promise<PromotionRule[]> {
    const rows = await client.promotion.findMany({ where: { active: true } });
    return rows.map((row) => toPromotionRule(row as unknown as PromotionRow)).filter((rule): rule is PromotionRule => rule !== null);
}
