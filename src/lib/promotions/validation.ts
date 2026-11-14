import { isDayKey } from '@/lib/day-key';
import { isPromotionAudience, type PromotionAudience } from '@/lib/promotions/engine';

/**
 * Dados prontos para gravar. `type` e `priority` ficam de fora de propósito:
 * o tipo é sempre CUSTOM na criação (preservado na edição) e o desempate é automático.
 */
export type PromotionInput = {
    name: string;
    badgeLabel: string | null;
    active: boolean;
    discountPercent: number;
    maxDiscountAmount: number | null;
    minDaysBeforeCheckIn: number | null;
    maxDaysBeforeCheckIn: number | null;
    stayStart: Date | null;
    stayEnd: Date | null;
    /** JSON [{from,to}] com as datas em que a promoção não vale; null = sem exclusões. */
    excludedStayDates: string | null;
    /** JSON [0..6] (0 = domingo) com os dias da semana em que vale; null = todos os dias. */
    daysOfWeek: string | null;
    bookableFrom: Date | null;
    bookableUntil: Date | null;
    minNights: number | null;
    allowedRoomTypeIds: string | null;
    stackWithCoupons: boolean;
    allowedCouponIds: string | null;
    stackWithPromotions: boolean;
    allowedPromotionIds: string | null;
    exclusive: boolean;
    audience: PromotionAudience;
    showBadge: boolean;
};

export type PromotionParseResult = { ok: true; data: PromotionInput } | { ok: false; error: string };

function str(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function numOrNull(value: unknown): number | null | 'invalid' {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : 'invalid';
}

function intOrNull(value: unknown): number | null | 'invalid' {
    const n = numOrNull(value);
    if (n === null || n === 'invalid') return n;
    return Number.isInteger(n) ? n : 'invalid';
}

function dayOrNull(value: unknown): Date | null | 'invalid' {
    const s = str(value).slice(0, 10);
    if (!s) return null;
    if (!isDayKey(s)) return 'invalid';
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? 'invalid' : d;
}

const MAX_EXCLUDED_RANGES = 200;

/** Formato AAAA-MM-DD E data que existe no calendário (isDayKey só confere o formato). */
function isRealDay(value: string) {
    if (!isDayKey(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Datas excluídas: lista de { from, to } (to opcional = só o dia de `from`) ou de strings AAAA-MM-DD.
 * Devolve JSON ordenado e sem repetições; lista vazia vira null.
 */
function excludedRanges(value: unknown): { ok: true; json: string | null } | { ok: false } {
    if (value === null || value === undefined || value === '') return { ok: true, json: null };
    if (!Array.isArray(value)) return { ok: false };
    if (value.length > MAX_EXCLUDED_RANGES) return { ok: false };

    const ranges = new Map<string, { from: string; to: string }>();
    for (const item of value) {
        const raw = (item && typeof item === 'object' ? item : { from: item }) as Record<string, unknown>;
        const from = str(raw.from).slice(0, 10);
        const to = (str(raw.to).slice(0, 10) || from);
        if (!isRealDay(from) || !isRealDay(to) || from > to) return { ok: false };
        ranges.set(`${from}|${to}`, { from, to });
    }
    if (ranges.size === 0) return { ok: true, json: null };
    const sorted = [...ranges.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    return { ok: true, json: JSON.stringify(sorted) };
}

/**
 * Dias da semana (0 = domingo … 6 = sábado). Ausente ou com os 7 dias = todos (null).
 * Lista vazia é erro: uma promoção sem nenhum dia nunca valeria.
 */
function weekdayList(value: unknown): { ok: true; json: string | null } | { ok: false } {
    if (value === null || value === undefined || value === '') return { ok: true, json: null };
    if (!Array.isArray(value) || value.length === 0) return { ok: false };
    const days = new Set<number>();
    for (const item of value) {
        const n = typeof item === 'string' && item.trim() !== '' ? Number(item) : item;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 6) return { ok: false };
        days.add(n);
    }
    if (days.size === 7) return { ok: true, json: null };
    return { ok: true, json: JSON.stringify([...days].sort((a, b) => a - b)) };
}

function idList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((v) => str(v)).filter(Boolean)));
}

/**
 * Lista de ids permitidos para acúmulo.
 * Acúmulo desligado → null (irrelevante). Ligado e sem lista (null/undefined) → null = "todos".
 * Ligado com lista → só esses; lista vazia é erro (ambígua: "nenhum" ou "todos"?).
 */
function stackList(enabled: boolean, value: unknown): { ok: true; json: string | null } | { ok: false } {
    if (!enabled || value === null || value === undefined) return { ok: true, json: null };
    if (!Array.isArray(value)) return { ok: true, json: null };
    const ids = idList(value);
    if (ids.length === 0) return { ok: false };
    return { ok: true, json: JSON.stringify(ids) };
}

/**
 * Valida o corpo enviado pelo painel admin (criação e edição usam o mesmo contrato).
 * Únicos campos obrigatórios: nome e percentual. Todas as condições são opcionais e combináveis.
 */
export function parsePromotionInput(body: unknown): PromotionParseResult {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

    const name = str(b.name);
    if (!name) return { ok: false, error: 'Nome obrigatório' };

    const discountPercent = numOrNull(b.discountPercent);
    if (discountPercent === null || discountPercent === 'invalid' || discountPercent <= 0 || discountPercent > 100) {
        return { ok: false, error: 'Percentual deve ser maior que 0 e no máximo 100' };
    }

    const maxDiscountAmount = numOrNull(b.maxDiscountAmount);
    if (maxDiscountAmount === 'invalid' || (maxDiscountAmount !== null && maxDiscountAmount <= 0)) {
        return { ok: false, error: 'Teto de desconto inválido' };
    }

    const minDays = intOrNull(b.minDaysBeforeCheckIn);
    const maxDays = intOrNull(b.maxDaysBeforeCheckIn);
    if (minDays === 'invalid' || maxDays === 'invalid' || (minDays !== null && minDays < 0) || (maxDays !== null && maxDays < 0)) {
        return { ok: false, error: 'Dias de antecedência inválidos' };
    }
    if (minDays !== null && maxDays !== null && minDays > maxDays) {
        return { ok: false, error: 'Antecedência mínima não pode ser maior que a máxima' };
    }

    const minNights = intOrNull(b.minNights);
    if (minNights === 'invalid' || (minNights !== null && minNights < 1)) {
        return { ok: false, error: 'Mínimo de noites inválido' };
    }

    const stayStart = dayOrNull(b.stayStart);
    const stayEnd = dayOrNull(b.stayEnd);
    const bookableFrom = dayOrNull(b.bookableFrom);
    const bookableUntil = dayOrNull(b.bookableUntil);
    if ([stayStart, stayEnd, bookableFrom, bookableUntil].includes('invalid')) {
        return { ok: false, error: 'Data inválida (use AAAA-MM-DD)' };
    }
    const sS = stayStart as Date | null;
    const sE = stayEnd as Date | null;
    const bF = bookableFrom as Date | null;
    const bU = bookableUntil as Date | null;
    if (sS && sE && sS > sE) return { ok: false, error: 'Início da estadia deve ser anterior ao fim' };
    if (bF && bU && bF > bU) return { ok: false, error: 'Início da janela de venda deve ser anterior ao fim' };

    const excluded = excludedRanges(b.excludedStayDates);
    if (!excluded.ok) {
        return { ok: false, error: 'Datas excluídas inválidas (use AAAA-MM-DD; a data final não pode ser antes da inicial)' };
    }

    const weekdays = weekdayList(b.daysOfWeek);
    if (!weekdays.ok) return { ok: false, error: 'Dias da semana inválidos: marque ao menos um dia' };

    const audienceRaw = b.audience === undefined || b.audience === null || b.audience === '' ? 'all' : b.audience;
    if (!isPromotionAudience(audienceRaw)) return { ok: false, error: 'Público inválido (use all ou mobile)' };

    const roomIds = idList(b.allowedRoomTypeIds);

    // "Não acumular com nada" sobrepõe qualquer acúmulo.
    const exclusive = Boolean(b.exclusive);
    const stackWithCoupons = !exclusive && Boolean(b.stackWithCoupons);
    const stackWithPromotions = !exclusive && Boolean(b.stackWithPromotions);

    const couponList = stackList(stackWithCoupons, b.allowedCouponIds);
    if (!couponList.ok) return { ok: false, error: 'Selecione ao menos um cupom ou marque "todos os cupons"' };
    const promotionList = stackList(stackWithPromotions, b.allowedPromotionIds);
    if (!promotionList.ok) return { ok: false, error: 'Selecione ao menos uma promoção ou marque "qualquer outra promoção"' };

    return {
        ok: true,
        data: {
            name,
            badgeLabel: str(b.badgeLabel) || null,
            active: b.active === undefined ? true : Boolean(b.active),
            discountPercent,
            maxDiscountAmount,
            minDaysBeforeCheckIn: minDays,
            maxDaysBeforeCheckIn: maxDays,
            stayStart: sS,
            stayEnd: sE,
            excludedStayDates: excluded.json,
            daysOfWeek: weekdays.json,
            bookableFrom: bF,
            bookableUntil: bU,
            minNights,
            allowedRoomTypeIds: roomIds.length > 0 ? JSON.stringify(roomIds) : null,
            stackWithCoupons,
            allowedCouponIds: couponList.json,
            stackWithPromotions,
            allowedPromotionIds: promotionList.json,
            exclusive,
            audience: audienceRaw,
            showBadge: b.showBadge === undefined || b.showBadge === null ? true : Boolean(b.showBadge),
        },
    };
}
