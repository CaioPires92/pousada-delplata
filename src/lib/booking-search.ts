import { addDays, format } from 'date-fns';

import { MAX_BOOKING_GUESTS } from '@/lib/booking-capacity';
import { compareDayKey, isDayKey } from '@/lib/day-key';
import { getEffectiveGuestCounts } from '@/lib/guest-capacity';

/**
 * Fonte única das regras de busca de reserva (datas + hóspedes), usada pela Home,
 * pelo SearchWidget de /reservar e pela barra fixa. A URL de /reservar é a fonte de verdade.
 */

/** Idade de criança; `null` = ainda não informada. */
export type ChildAge = number | null;

export type BookingSearchValues = {
    /** YYYY-MM-DD */
    checkIn: string;
    /** YYYY-MM-DD */
    checkOut: string;
    adults: number;
    children: number;
    childrenAges: ChildAge[];
    pets?: number;
};

export type BookingSearchField = 'dates' | 'guests' | 'childrenAges';

export type BookingSearchValidation =
    | { ok: true }
    | { ok: false; field: BookingSearchField; message: string; code: 'dates' | 'past' | 'adults' | 'ages_missing' | 'ages_range' | 'capacity' };

export const SEARCH_MESSAGES = {
    datesMissing: 'Selecione check-in e check-out para ver a disponibilidade.',
    datesOrder: 'A saída deve ser pelo menos 1 dia após o check-in.',
    datesPast: 'O check-in não pode ser anterior a hoje.',
    adults: 'Selecione ao menos 1 adulto para continuar.',
    agesMissing: 'Informe a idade de todas as crianças para calcular a tarifa corretamente.',
    agesRange: 'Revise as idades informadas. Aceitamos crianças de 0 a 17 anos.',
    capacity: `Cada acomodação recebe até ${MAX_BOOKING_GUESTS} hóspedes. Se precisar de mais espaço, fale com a pousada para montar a melhor combinação.`,
} as const;

/* ---------- datas ---------- */

export function toDayKey(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

/** Meio-dia local: evita virar o dia por fuso/horário de verão. */
export function fromDayKey(dayKey: string): Date {
    return new Date(`${dayKey}T12:00:00`);
}

export function addDaysToKey(dayKey: string, days: number): string {
    return toDayKey(addDays(fromDayKey(dayKey), days));
}

export function nightsBetween(checkIn: string, checkOut: string): number {
    const diff = Math.round((fromDayKey(checkOut).getTime() - fromDayKey(checkIn).getTime()) / 86_400_000);
    return Math.max(1, diff);
}

/** Formato válido E data real (rejeita 2026-13-45). */
export function isRealDayKey(dayKey: string): boolean {
    if (!isDayKey(dayKey)) return false;
    const [y, m, d] = dayKey.split('-').map((part) => Number.parseInt(part, 10));
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function minStayMessage(nights: number): string {
    const n = Math.max(1, Math.trunc(nights) || 1);
    return `Para esta data, o mínimo de reservas é ${n} noite${n > 1 ? 's' : ''}.`;
}

/** Ao escolher um check-in, o check-out passa a ser o dia seguinte (comportamento comum a todos os formulários). */
export function checkOutAfterCheckIn(checkIn: string): string {
    return addDaysToKey(checkIn, 1);
}

/* ---------- hóspedes ---------- */

/** Mantém adultos/crianças dentro da lotação e o vetor de idades com o tamanho certo. */
export function normalizeGuests(
    input: { adults: number; children: number; childrenAges: ChildAge[] },
    padAge: ChildAge = 0,
): Pick<BookingSearchValues, 'adults' | 'children' | 'childrenAges'> {
    const adults = Math.min(Math.max(Math.trunc(input.adults) || 1, 1), MAX_BOOKING_GUESTS);
    const children = Math.min(Math.max(Math.trunc(input.children) || 0, 0), Math.max(0, MAX_BOOKING_GUESTS - adults));
    const childrenAges = input.childrenAges.slice(0, children);
    while (childrenAges.length < children) childrenAges.push(padAge);
    return { adults, children, childrenAges };
}

export function maxChildrenFor(adults: number): number {
    return Math.max(0, MAX_BOOKING_GUESTS - adults);
}

export function totalGuestsOf(values: Pick<BookingSearchValues, 'adults' | 'childrenAges' | 'children'>): number {
    const numericAges = values.childrenAges.filter((age): age is number => typeof age === 'number');
    const effective = getEffectiveGuestCounts({ adults: values.adults, childrenAges: numericAges });
    // Crianças sem idade ainda contam como pessoas na ocupação.
    return effective.totalGuests + Math.max(0, values.children - numericAges.length);
}

/* ---------- validação ---------- */

export function validateBookingSearch(values: BookingSearchValues, todayKey: string = toDayKey(new Date())): BookingSearchValidation {
    if (values.adults < 1) {
        return { ok: false, field: 'guests', code: 'adults', message: SEARCH_MESSAGES.adults };
    }

    if (values.children > 0) {
        if (values.childrenAges.length !== values.children || values.childrenAges.some((age) => age === null)) {
            return { ok: false, field: 'childrenAges', code: 'ages_missing', message: SEARCH_MESSAGES.agesMissing };
        }
        if (values.childrenAges.some((age) => typeof age !== 'number' || !Number.isFinite(age) || age < 0 || age > 17)) {
            return { ok: false, field: 'childrenAges', code: 'ages_range', message: SEARCH_MESSAGES.agesRange };
        }
    }

    if (totalGuestsOf(values) > MAX_BOOKING_GUESTS) {
        return { ok: false, field: 'guests', code: 'capacity', message: SEARCH_MESSAGES.capacity };
    }

    if (!isRealDayKey(values.checkIn) || !isRealDayKey(values.checkOut)) {
        return { ok: false, field: 'dates', code: 'dates', message: SEARCH_MESSAGES.datesMissing };
    }
    if (compareDayKey(values.checkOut, values.checkIn) <= 0) {
        return { ok: false, field: 'dates', code: 'dates', message: SEARCH_MESSAGES.datesOrder };
    }
    if (isDayKey(todayKey) && compareDayKey(values.checkIn, todayKey) < 0) {
        return { ok: false, field: 'dates', code: 'past', message: SEARCH_MESSAGES.datesPast };
    }

    return { ok: true };
}

/* ---------- URL de /reservar ---------- */

export type ReservarUrlExtras = {
    roomTypeId?: string | null;
    promo?: string | null;
    promoLock?: boolean;
};

/** Ordem estável dos parâmetros: base, roomTypeId, childrenAges, promo, promoLock. */
export function buildReservarParams(values: BookingSearchValues, extras: ReservarUrlExtras = {}): URLSearchParams {
    const params = new URLSearchParams({
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        adults: String(values.adults),
        children: String(values.children),
    });
    if (extras.roomTypeId) params.set('roomTypeId', extras.roomTypeId);

    const ages = values.childrenAges.slice(0, values.children).filter((age): age is number => typeof age === 'number' && Number.isFinite(age));
    if (values.children > 0 && ages.length === values.children) {
        params.set('childrenAges', ages.map(String).join(','));
    }
    const pets = Math.min(Math.max(Math.trunc(values.pets ?? 0), 0), 10);
    if (pets > 0) params.set('pets', String(pets));

    const promo = String(extras.promo ?? '').trim().toUpperCase();
    if (promo) {
        params.set('promo', promo);
        if (extras.promoLock) params.set('promoLock', '1');
    }
    return params;
}

export function buildReservarUrl(values: BookingSearchValues, extras: ReservarUrlExtras = {}): string {
    return `/reservar?${buildReservarParams(values, extras).toString()}`;
}

export type ParsedReservarParams = Partial<BookingSearchValues>;

/** Lê checkIn/checkOut/adults/children/childrenAges de qualquer coisa com `.get(key)`. */
export function parseReservarParams(source: { get(key: string): string | null }): ParsedReservarParams {
    const out: ParsedReservarParams = {};

    const checkIn = source.get('checkIn');
    const checkOut = source.get('checkOut');
    if (checkIn && isRealDayKey(checkIn)) out.checkIn = checkIn;
    if (checkOut && isRealDayKey(checkOut)) out.checkOut = checkOut;

    const adults = Number.parseInt(String(source.get('adults') ?? ''), 10);
    const children = Number.parseInt(String(source.get('children') ?? ''), 10);
    const pets = Number.parseInt(String(source.get('pets') ?? ''), 10);
    if (Number.isFinite(adults)) out.adults = Math.min(Math.max(adults, 1), MAX_BOOKING_GUESTS);
    if (Number.isFinite(children)) {
        const normalizedChildren = Math.min(Math.max(children, 0), 10);
        out.children = normalizedChildren;
        const ages: ChildAge[] = String(source.get('childrenAges') ?? '')
            .split(',')
            .map((item) => Number.parseInt(item.trim(), 10))
            .filter((age) => Number.isFinite(age))
            .slice(0, normalizedChildren)
            .map((age) => Math.min(Math.max(age, 0), 17));
        while (ages.length < normalizedChildren) ages.push(null);
        out.childrenAges = ages;
    }
    if (Number.isFinite(pets)) out.pets = Math.min(Math.max(pets, 0), 10);

    return out;
}

/** Datas padrão: hoje → amanhã. */
export function defaultSearchValues(now: Date = new Date()): BookingSearchValues {
    return {
        checkIn: toDayKey(now),
        checkOut: toDayKey(addDays(now, 1)),
        adults: 2,
        children: 0,
        childrenAges: [],
    };
}
