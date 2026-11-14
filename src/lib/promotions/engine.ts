import { compareDayKey, eachDayKeyInclusive, isDayKey, prevDayKey } from '@/lib/day-key';

export const PROMOTION_TIME_ZONE = 'America/Sao_Paulo';

/**
 * `CUSTOM` é o tipo das promoções criadas pelo construtor livre do painel.
 * Os três tipos antigos continuam existindo só para promoções já cadastradas
 * (definem apenas a etiqueta padrão; nenhuma regra depende deles).
 */
export const PROMOTION_TYPES = ['CUSTOM', 'LAST_MINUTE', 'EARLY_BIRD', 'SEASONAL'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export function isPromotionType(value: unknown): value is PromotionType {
    return typeof value === 'string' && (PROMOTION_TYPES as readonly string[]).includes(value);
}

/**
 * Regra de promoção já normalizada (datas como YYYY-MM-DD, números como number).
 * Todas as restrições nulas são ignoradas e as condições presentes se combinam (E).
 */
export const PROMOTION_AUDIENCES = ['all', 'mobile'] as const;
export type PromotionAudience = (typeof PROMOTION_AUDIENCES)[number];

export function isPromotionAudience(value: unknown): value is PromotionAudience {
    return typeof value === 'string' && (PROMOTION_AUDIENCES as readonly string[]).includes(value);
}

/** Intervalo de datas (AAAA-MM-DD), com as duas pontas inclusivas. */
export type StayDateRange = { from: string; to: string };

export type PromotionRule = {
    id: string;
    name: string;
    badgeLabel: string | null;
    type: PromotionType;
    active: boolean;
    discountPercent: number;
    maxDiscountAmount: number | null;
    /** Reserva feita com pelo menos X dias de antecedência. */
    minDaysBeforeCheckIn: number | null;
    /** Reserva feita com no máximo X dias de antecedência. 0 = no próprio dia. */
    maxDaysBeforeCheckIn: number | null;
    /**
     * Período de estadia (cada ponta é opcional). A regra é NOITE A NOITE: só as noites dentro de
     * [stayStart, stayEnd] recebem o desconto; as demais noites da mesma reserva pagam o preço normal.
     */
    stayStart: string | null;
    stayEnd: string | null;
    /**
     * Noites em que a promoção NÃO vale (ex.: um dia de alta procura). Também é por noite: a reserva
     * que passa por esse dia recebe o desconto nas outras noites. Ausente/vazio = sem exclusões.
     */
    excludedStayRanges?: StayDateRange[];
    /**
     * Dias da semana (0 = domingo … 6 = sábado) em que a promoção vale, por noite.
     * Ausente, null ou vazio = todos os dias.
     */
    daysOfWeek?: number[] | null;
    /** Janela em que a promoção pode ser reservada (inclusiva), no fuso da pousada. */
    bookableFrom: string | null;
    bookableUntil: string | null;
    minNights: number | null;
    /** Vazio = todos os quartos. */
    allowedRoomTypeIds: string[];
    /** Pode acumular com cupom (o cupom também precisa permitir). */
    stackWithCoupons: boolean;
    /** null = qualquer cupom que permita acúmulo; lista = só esses cupons. */
    allowedCouponIds: string[] | null;
    /** Pode acumular com outras promoções (a outra também precisa permitir, e aceitar esta). */
    stackWithPromotions: boolean;
    /** null = qualquer outra promoção; lista = só essas. */
    allowedPromotionIds: string[] | null;
    /** Não acumula com nada (cupom ou outra promoção). */
    exclusive: boolean;
    /** 'mobile' = só vale para quem reserva pelo celular. */
    audience: PromotionAudience;
    /** false = desconto vale, mas a promoção não aparece (nome/etiqueta) para o hóspede. */
    showBadge: boolean;
    /** Epoch ms; usado só no desempate automático (mais recente vence). */
    createdAt: number;
};

export type ResolvedPromotionItem = {
    id: string;
    /** Nome interno (admin). Para o hóspede, use toPublicPromotion. */
    name: string;
    /** false = esconder etiqueta/nome do hóspede. */
    showBadge: boolean;
    type: PromotionType;
    badgeLabel: string;
    discountPercent: number;
    discountAmount: number;
};

/** Resultado da engine: uma promoção ou um conjunto de promoções acumuladas. */
export type ResolvedPromotion = {
    /** Id da primeira promoção aplicada (a de maior percentual). */
    id: string;
    /** Nomes das promoções aplicadas, separados por " + ". */
    name: string;
    type: PromotionType;
    badgeLabel: string;
    /** Percentual efetivo sobre a base elegível. */
    discountPercent: number;
    /** Desconto total (soma das promoções aplicadas). */
    discountAmount: number;
    stackWithCoupons: boolean;
    /** null = qualquer cupom compatível; lista = só esses. */
    allowedCouponIds: string[] | null;
    exclusive: boolean;
    items: ResolvedPromotionItem[];
    /** Total da hospedagem sobre o qual o desconto foi calculado (base do percentual real). */
    eligibleAmount?: number;
};

export type ResolvePromotionInput = {
    promotions: PromotionRule[];
    /** "Hoje" no fuso da pousada, YYYY-MM-DD (ver todayDayKey). */
    bookingDayKey: string;
    checkIn: string;
    checkOut: string;
    roomTypeId?: string;
    /** Reserva feita de um celular (detectado no servidor). Só importa para promoções com audience 'mobile'. */
    isMobile?: boolean;
    /** Valor sobre o qual o % incide: total da hospedagem. */
    eligibleAmount: number;
    /**
     * Valor de cada noite (diária + extras). Com ele o desconto é calculado noite a noite; sem ele o
     * total é dividido igualmente entre as noites.
     */
    nightAmounts?: NightAmount[];
};

export type NightAmount = { day: string; amount: number };

/** Teto de candidatas na busca de combinações (2^12 = 4096 subconjuntos no pior caso). */
const MAX_COMBINATION_CANDIDATES = 12;

function roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function todayDayKey(now: Date = new Date(), timeZone: string = PROMOTION_TIME_ZONE) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}

export function daysBetween(fromDayKey: string, toDayKey: string) {
    const toUtc = (key: string) => {
        const [y, m, d] = key.split('-').map((x) => Number.parseInt(x, 10));
        return Date.UTC(y, m - 1, d);
    };
    return Math.round((toUtc(toDayKey) - toUtc(fromDayKey)) / 86_400_000);
}

function formatPercent(percent: number) {
    return `${Number(percent.toFixed(2))}%`;
}

export function defaultBadgeLabel(type: PromotionType, percent: number) {
    const pct = formatPercent(percent);
    if (type === 'LAST_MINUTE') return `🔥 Oferta de Última Hora: ${pct} OFF`;
    if (type === 'EARLY_BIRD') return `🐦 Reserva Antecipada: ${pct} OFF`;
    if (type === 'SEASONAL') return `🌿 Oferta de Temporada: ${pct} OFF`;
    return `🏷️ Oferta Especial: ${pct} OFF`;
}

type StayContext = Pick<ResolvePromotionInput, 'bookingDayKey' | 'checkIn' | 'checkOut' | 'roomTypeId' | 'isMobile'>;

/** Noites da estadia (AAAA-MM-DD): do check-in até a véspera do check-out. */
export function stayNights(checkIn: string, checkOut: string): string[] {
    if (!isDayKey(checkIn) || !isDayKey(checkOut) || compareDayKey(checkIn, checkOut) >= 0) return [];
    return eachDayKeyInclusive(checkIn, prevDayKey(checkOut));
}

function weekdayOf(dayKey: string) {
    const [year, month, day] = dayKey.split('-').map((part) => Number.parseInt(part, 10));
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Condições que valem para a RESERVA inteira: se alguma falhar, nenhuma noite recebe desconto.
 * (ativa, público, quarto, janela de venda, antecedência e noites mínimas)
 */
export function isPromotionEligibleForStay(promotion: PromotionRule, ctx: StayContext) {
    if (!promotion.active) return false;
    if (promotion.audience === 'mobile' && !ctx.isMobile) return false;
    if (!isDayKey(ctx.checkIn) || !isDayKey(ctx.checkOut) || compareDayKey(ctx.checkIn, ctx.checkOut) >= 0) return false;
    if (!isDayKey(ctx.bookingDayKey)) return false;

    if (promotion.allowedRoomTypeIds.length > 0 && (!ctx.roomTypeId || !promotion.allowedRoomTypeIds.includes(ctx.roomTypeId))) {
        return false;
    }

    if (promotion.bookableFrom && compareDayKey(ctx.bookingDayKey, promotion.bookableFrom) < 0) return false;
    if (promotion.bookableUntil && compareDayKey(ctx.bookingDayKey, promotion.bookableUntil) > 0) return false;

    const daysAhead = daysBetween(ctx.bookingDayKey, ctx.checkIn);
    if (daysAhead < 0) return false;
    if (promotion.minDaysBeforeCheckIn !== null && daysAhead < promotion.minDaysBeforeCheckIn) return false;
    if (promotion.maxDaysBeforeCheckIn !== null && daysAhead > promotion.maxDaysBeforeCheckIn) return false;

    const nights = daysBetween(ctx.checkIn, ctx.checkOut);
    if (promotion.minNights !== null && nights < promotion.minNights) return false;

    return true;
}

/** Condições avaliadas NOITE A NOITE: período de estadia, dia da semana e dias removidos. */
export function isNightEligible(promotion: PromotionRule, dayKey: string) {
    if (promotion.stayStart && compareDayKey(dayKey, promotion.stayStart) < 0) return false;
    if (promotion.stayEnd && compareDayKey(dayKey, promotion.stayEnd) > 0) return false;
    if (promotion.daysOfWeek && promotion.daysOfWeek.length > 0 && !promotion.daysOfWeek.includes(weekdayOf(dayKey))) return false;
    if (promotion.excludedStayRanges?.some((range) => compareDayKey(range.from, dayKey) <= 0 && compareDayKey(range.to, dayKey) >= 0)) {
        return false;
    }
    return true;
}

/** A promoção vale para a reserva e para ao menos uma de suas noites. */
export function isPromotionEligible(promotion: PromotionRule, ctx: StayContext) {
    if (!isPromotionEligibleForStay(promotion, ctx)) return false;
    return stayNights(ctx.checkIn, ctx.checkOut).some((night) => isNightEligible(promotion, night));
}

export function calculatePromotionDiscount(promotion: Pick<PromotionRule, 'discountPercent' | 'maxDiscountAmount'>, eligibleAmount: number) {
    if (!Number.isFinite(eligibleAmount) || eligibleAmount <= 0) return 0;
    const percent = Math.min(100, Math.max(0, promotion.discountPercent));
    let amount = eligibleAmount * (percent / 100);
    if (promotion.maxDiscountAmount !== null && Number.isFinite(promotion.maxDiscountAmount)) {
        amount = Math.min(amount, promotion.maxDiscountAmount);
    }
    return roundMoney(Math.max(0, Math.min(amount, eligibleAmount)));
}

/**
 * Duas promoções só acumulam com consentimento mútuo: cada uma precisa permitir acúmulo
 * com promoções E aceitar a outra (lista null = qualquer). `exclusive` nunca acumula.
 */
export function arePromotionsCompatible(a: PromotionRule, b: PromotionRule) {
    if (a.exclusive || b.exclusive) return false;
    if (!a.stackWithPromotions || !b.stackWithPromotions) return false;
    const accepts = (x: PromotionRule, y: PromotionRule) => x.allowedPromotionIds === null || x.allowedPromotionIds.includes(y.id);
    return accepts(a, b) && accepts(b, a);
}

type CascadeItem = { rule: PromotionRule; amount: number };

/**
 * Aplica as promoções em cascata: cada percentual incide sobre o saldo já descontado
 * (10% + 10% = 19%). Ordem determinística: maior percentual primeiro, depois id.
 */
function applyCascade(rules: PromotionRule[], eligibleAmount: number) {
    const ordered = [...rules].sort((a, b) => b.discountPercent - a.discountPercent || a.id.localeCompare(b.id));
    let remaining = eligibleAmount;
    const items: CascadeItem[] = [];
    for (const rule of ordered) {
        const amount = calculatePromotionDiscount(rule, remaining);
        if (amount <= 0) continue;
        remaining = roundMoney(remaining - amount);
        items.push({ rule, amount });
    }
    const total = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
    return { items, total };
}

type Candidate = { items: CascadeItem[]; total: number };

function newestCreatedAt(candidate: Candidate) {
    return Math.max(...candidate.items.map((item) => item.rule.createdAt));
}

function candidateKey(candidate: Candidate) {
    return candidate.items.map((item) => item.rule.id).join('+');
}

/** Maior desconto; empate → promoção mais recente; depois id (determinístico). */
function isBetterCandidate(next: Candidate, best: Candidate) {
    if (next.total !== best.total) return next.total > best.total;
    const nextNewest = newestCreatedAt(next);
    const bestNewest = newestCreatedAt(best);
    if (nextNewest !== bestNewest) return nextNewest > bestNewest;
    return candidateKey(next) < candidateKey(best);
}

function intersectCouponLists(lists: Array<string[] | null>): string[] | null {
    const restricted = lists.filter((list): list is string[] => list !== null);
    if (restricted.length === 0) return null;
    return restricted.reduce((acc, list) => acc.filter((id) => list.includes(id)));
}

function toItem(entry: CascadeItem): ResolvedPromotionItem {
    const { rule, amount } = entry;
    return {
        id: rule.id,
        name: rule.name,
        showBadge: rule.showBadge,
        type: rule.type,
        badgeLabel: rule.badgeLabel?.trim() || defaultBadgeLabel(rule.type, rule.discountPercent),
        discountPercent: rule.discountPercent,
        discountAmount: amount,
    };
}

/** Melhor oferta para UM valor: uma promoção ou um conjunto que aceita acumular, o que der o maior desconto. */
function bestCandidateForAmount(rules: PromotionRule[], eligibleAmount: number, ignoreCaps: boolean): Candidate | null {
    const pool = ignoreCaps ? rules.map((rule) => (rule.maxDiscountAmount === null ? rule : { ...rule, maxDiscountAmount: null })) : rules;
    const candidates = pool
        .map((rule) => ({ rule, amount: calculatePromotionDiscount(rule, eligibleAmount) }))
        .filter((entry) => entry.amount > 0)
        .sort((a, b) => b.amount - a.amount || b.rule.createdAt - a.rule.createdAt || a.rule.id.localeCompare(b.rule.id))
        .slice(0, MAX_COMBINATION_CANDIDATES)
        .map((entry) => entry.rule);

    if (candidates.length === 0) return null;

    let best: Candidate | null = null;
    const consider = (chosen: PromotionRule[]) => {
        const cascade = applyCascade(chosen, eligibleAmount);
        if (cascade.items.length === 0) return;
        if (!best || isBetterCandidate(cascade, best)) best = cascade;
    };
    const extend = (chosen: PromotionRule[], from: number) => {
        for (let i = from; i < candidates.length; i += 1) {
            const next = candidates[i];
            if (!chosen.every((picked) => arePromotionsCompatible(picked, next))) continue;
            const set = [...chosen, next];
            consider(set);
            extend(set, i + 1);
        }
    };
    extend([], 0);

    return best as Candidate | null;
}

/** Valor de cada noite: o informado pelo chamador ou, sem ele, o total dividido igualmente. */
function resolveNightAmounts(nights: string[], input: ResolvePromotionInput) {
    const byDay = new Map((input.nightAmounts ?? []).map((entry) => [entry.day, entry.amount]));
    const share = nights.length > 0 ? input.eligibleAmount / nights.length : 0;
    return nights.map((night) => {
        const amount = byDay.get(night);
        return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : share;
    });
}

/**
 * Escolhe a melhor oferta automática, NOITE A NOITE (como o Booking): cada noite recebe a melhor
 * promoção (ou conjunto que aceita acumular) entre as que valem naquela noite; os descontos das noites
 * se somam. Noites com o mesmo conjunto de promoções são calculadas juntas, então uma reserva em que
 * todas as noites valem dá exatamente o mesmo resultado de antes.
 * Desempate automático: promoção mais recente, depois id.
 *
 * Se mais de um grupo de noites existir, o teto em R$ (maxDiscountAmount) é aplicado ao total de cada
 * promoção na reserva, não por noite.
 */
export function resolveBestPromotion(input: ResolvePromotionInput): ResolvedPromotion | null {
    const stayRules = input.promotions.filter((rule) => isPromotionEligibleForStay(rule, input));
    if (stayRules.length === 0) return null;

    const nights = stayNights(input.checkIn, input.checkOut);
    const amounts = resolveNightAmounts(nights, input);

    const groups = new Map<string, { rules: PromotionRule[]; amount: number }>();
    nights.forEach((night, index) => {
        const rules = stayRules.filter((rule) => isNightEligible(rule, night));
        if (rules.length === 0) return;
        const key = rules.map((rule) => rule.id).sort().join('|');
        const group = groups.get(key) ?? { rules, amount: 0 };
        group.amount += amounts[index];
        groups.set(key, group);
    });
    if (groups.size === 0) return null;

    const singleGroup = groups.size === 1;
    const winners: Candidate[] = [];
    for (const group of groups.values()) {
        const winner = bestCandidateForAmount(group.rules, roundMoney(group.amount), !singleGroup);
        if (winner) winners.push(winner);
    }
    if (winners.length === 0) return null;

    const byRule = new Map<string, CascadeItem>();
    for (const winner of winners) {
        for (const entry of winner.items) {
            const current = byRule.get(entry.rule.id);
            byRule.set(entry.rule.id, { rule: entry.rule, amount: roundMoney((current?.amount ?? 0) + entry.amount) });
        }
    }
    const merged = [...byRule.values()]
        .map((entry) => {
            const cap = entry.rule.maxDiscountAmount;
            return !singleGroup && cap !== null && Number.isFinite(cap) && entry.amount > cap ? { ...entry, amount: roundMoney(cap) } : entry;
        })
        .filter((entry) => entry.amount > 0)
        .sort((a, b) => b.rule.discountPercent - a.rule.discountPercent || a.rule.id.localeCompare(b.rule.id));
    if (merged.length === 0) return null;

    const total = roundMoney(merged.reduce((sum, entry) => sum + entry.amount, 0));
    const items = merged.map(toItem);
    const rules = merged.map((entry) => entry.rule);
    const single = rules.length === 1 ? rules[0] : null;
    const effectivePercent = input.eligibleAmount > 0 ? Math.round((total / input.eligibleAmount) * 10000) / 100 : 0;

    return {
        id: items[0].id,
        name: items.map((item) => item.name).join(' + '),
        type: items[0].type,
        badgeLabel: items[0].badgeLabel,
        discountPercent: single ? single.discountPercent : effectivePercent,
        discountAmount: total,
        stackWithCoupons: rules.every((rule) => rule.stackWithCoupons && !rule.exclusive),
        allowedCouponIds: intersectCouponLists(rules.map((rule) => rule.allowedCouponIds)),
        exclusive: rules.some((rule) => rule.exclusive),
        items,
        eligibleAmount: input.eligibleAmount,
    };
}

/** Nome da categoria "Reserva direta" na linha do resumo da reserva. */
export const HIDDEN_PROMOTION_PUBLIC_NAME = 'Desconto reserva direta';
/** A mesma categoria como etiqueta do selo (aparece junto com as campanhas visíveis). */
export const DIRECT_BOOKING_BADGE_TAG = '🏡 Reserva direta';

/** Percentual para o hóspede: "31,6%" (vírgula; arredondado na primeira casa, como ele calcularia de cabeça). */
function formatGuestPercent(percent: number) {
    return `${String(roundToTenth(percent)).replace('.', ',')}%`;
}

function roundToTenth(value: number) {
    return Math.round(value * 10) / 10;
}

const PERCENT_TOKEN = /\s*[:\-–—|·]?\s*\d+(?:[.,]\d+)?\s*%(?:\s*(?:OFF|de desconto|desconto))?/gi;

/** Tira do texto o percentual escrito à mão ("🔥 Última hora: 10% OFF" → "🔥 Última hora"). */
export function stripPercentFromLabel(label: string) {
    return label.replace(PERCENT_TOKEN, '').replace(/[\s:\-–—|·]+$/, '').trim();
}

/**
 * Versão da promoção resolvida que pode ir para o hóspede (API pública / telas).
 * - Promoções com `showBadge: false` formam a categoria "Reserva direta" (ex.: Genius, Não
 *   reembolsável): seus descontos são SOMADOS numa linha só ("Desconto reserva direta") e o nome de
 *   cada uma nunca aparece. No selo a categoria entra como uma etiqueta ("🏡 Reserva direta").
 *   O valor do desconto não muda — só a identificação.
 * - A etiqueta mostra o percentual REAL da reserva (o que de fato foi descontado do total), não o
 *   percentual de uma promoção isolada: com descontos acumulados ou ocultos o preço cai mais do que
 *   o "10% OFF" de uma delas. Várias promoções visíveis viram uma etiqueta só ("A + B: 38,4% OFF").
 * - Os nomes das promoções visíveis perdem o percentual escrito neles (nos descontos em cascata
 *   cada linha não corresponde a "X% do total").
 * Quando há uma única promoção visível, sem ocultas e com o percentual igual ao do total, a
 * etiqueta digitada no painel é mantida exatamente como está.
 */
export function toPublicPromotion(promotion: ResolvedPromotion): ResolvedPromotion {
    const visible = promotion.items.filter((item) => item.showBadge);
    const hidden = promotion.items.filter((item) => !item.showBadge);

    const eligibleAmount =
        promotion.eligibleAmount ?? (promotion.discountPercent > 0 ? (promotion.discountAmount * 100) / promotion.discountPercent : 0);
    const totalPercent = eligibleAmount > 0 ? (promotion.discountAmount / eligibleAmount) * 100 : promotion.discountPercent;

    if (hidden.length === 0 && visible.length === 1 && Math.abs(totalPercent - visible[0].discountPercent) < 0.05) {
        return promotion;
    }

    const items: ResolvedPromotionItem[] = visible.map((item) => ({
        ...item,
        name: stripPercentFromLabel(item.name) || item.name,
    }));

    if (hidden.length > 0) {
        const hiddenAmount = roundMoney(hidden.reduce((sum, item) => sum + item.discountAmount, 0));
        items.push({
            id: 'direct-booking',
            name: HIDDEN_PROMOTION_PUBLIC_NAME,
            showBadge: false,
            type: 'CUSTOM',
            badgeLabel: '',
            discountPercent: eligibleAmount > 0 ? roundMoney((hiddenAmount / eligibleAmount) * 100) : 0,
            discountAmount: hiddenAmount,
        });
    }

    const tags = Array.from(
        new Set(visible.map((item) => stripPercentFromLabel(item.badgeLabel) || stripPercentFromLabel(item.name) || 'Oferta especial'))
    );
    if (hidden.length > 0) tags.push(DIRECT_BOOKING_BADGE_TAG);
    const badgeLabel = tags.length > 0 ? `${tags.join(' + ')}: ${formatGuestPercent(totalPercent)} OFF` : '';

    return {
        ...promotion,
        name: items.map((item) => item.name).join(' + '),
        badgeLabel,
        discountPercent: roundToTenth(totalPercent),
        items,
    };
}
