import { describe, expect, it } from 'vitest';
import {
    SEARCH_MESSAGES,
    addDaysToKey,
    buildReservarParams,
    buildReservarUrl,
    checkOutAfterCheckIn,
    defaultSearchValues,
    minStayMessage,
    nightsBetween,
    normalizeGuests,
    parseReservarParams,
    totalGuestsOf,
    validateBookingSearch,
    type BookingSearchValues,
} from '@/lib/booking-search';

const base: BookingSearchValues = { checkIn: '2026-12-10', checkOut: '2026-12-12', adults: 2, children: 0, childrenAges: [] };
const TODAY = '2026-11-11';

describe('datas', () => {
    it('check-out = dia seguinte ao check-in, inclusive na virada de mês/ano', () => {
        expect(checkOutAfterCheckIn('2027-10-01')).toBe('2027-10-02');
        expect(checkOutAfterCheckIn('2026-12-31')).toBe('2027-01-01');
    });

    it('conta noites e nunca devolve menos de 1', () => {
        expect(nightsBetween('2026-11-11', '2026-11-14')).toBe(3);
        expect(nightsBetween('2026-11-11', '2026-11-11')).toBe(1);
        expect(addDaysToKey('2026-02-27', 2)).toBe('2026-03-01');
    });

    it('mensagem de estadia mínima concorda no plural', () => {
        expect(minStayMessage(1)).toBe('Para esta data, o mínimo de reservas é 1 noite.');
        expect(minStayMessage(3)).toBe('Para esta data, o mínimo de reservas é 3 noites.');
    });
});

describe('normalizeGuests / totalGuestsOf', () => {
    it('limita adultos e crianças à lotação e ajusta o vetor de idades', () => {
        expect(normalizeGuests({ adults: 9, children: 3, childrenAges: [] })).toEqual({ adults: 6, children: 0, childrenAges: [] });
        expect(normalizeGuests({ adults: 2, children: 2, childrenAges: [5] })).toEqual({ adults: 2, children: 2, childrenAges: [5, 0] });
        expect(normalizeGuests({ adults: 2, children: 1, childrenAges: [] }, null).childrenAges).toEqual([null]);
    });

    it('criança de 12+ conta como adulto mas o total de pessoas é o mesmo', () => {
        expect(totalGuestsOf({ adults: 2, children: 2, childrenAges: [13, 4] })).toBe(4);
        expect(totalGuestsOf({ adults: 2, children: 2, childrenAges: [null, null] })).toBe(4);
    });
});

describe('validateBookingSearch', () => {
    it('aceita uma busca válida', () => {
        expect(validateBookingSearch(base, TODAY)).toEqual({ ok: true });
    });

    it('exige check-out depois do check-in', () => {
        const r = validateBookingSearch({ ...base, checkOut: base.checkIn }, TODAY);
        expect(r).toMatchObject({ ok: false, field: 'dates', message: SEARCH_MESSAGES.datesOrder });
    });

    it('recusa check-in no passado, mas aceita hoje', () => {
        expect(validateBookingSearch({ ...base, checkIn: '2026-11-10', checkOut: '2026-11-12' }, TODAY)).toMatchObject({ ok: false, code: 'past' });
        expect(validateBookingSearch({ ...base, checkIn: TODAY, checkOut: '2026-11-12' }, TODAY)).toEqual({ ok: true });
    });

    it('exige idade de todas as crianças e no intervalo 0-17', () => {
        expect(validateBookingSearch({ ...base, children: 1, childrenAges: [null] }, TODAY)).toMatchObject({ ok: false, code: 'ages_missing' });
        expect(validateBookingSearch({ ...base, children: 1, childrenAges: [18] }, TODAY)).toMatchObject({ ok: false, code: 'ages_range' });
        expect(validateBookingSearch({ ...base, children: 1, childrenAges: [7] }, TODAY)).toEqual({ ok: true });
    });

    it('recusa acima da lotação e sem adultos', () => {
        expect(validateBookingSearch({ ...base, adults: 5, children: 2, childrenAges: [3, 4] }, TODAY)).toMatchObject({ ok: false, code: 'capacity' });
        expect(validateBookingSearch({ ...base, adults: 0 }, TODAY)).toMatchObject({ ok: false, code: 'adults' });
    });
});

describe('URL de /reservar', () => {
    it('monta e lê de volta os mesmos valores (ida e volta)', () => {
        const values: BookingSearchValues = { checkIn: '2027-10-01', checkOut: '2027-10-03', adults: 2, children: 2, childrenAges: [4, 9] };
        const url = buildReservarUrl(values);
        expect(url).toBe('/reservar?checkIn=2027-10-01&checkOut=2027-10-03&adults=2&children=2&childrenAges=4%2C9');
        const parsed = parseReservarParams(new URL(url, 'https://x.test').searchParams);
        expect(parsed).toEqual(values);
    });

    it('mantém a ordem estável e inclui roomTypeId, cupom e promoLock', () => {
        const params = buildReservarParams({ ...base, children: 1, childrenAges: [0] }, { roomTypeId: 'r1', promo: ' vip10 ', promoLock: true });
        expect(params.toString()).toBe('checkIn=2026-12-10&checkOut=2026-12-12&adults=2&children=1&roomTypeId=r1&childrenAges=0&promo=VIP10&promoLock=1');
    });

    it('não envia childrenAges quando falta alguma idade', () => {
        expect(buildReservarParams({ ...base, children: 2, childrenAges: [3, null] }).has('childrenAges')).toBe(false);
    });

    it('ignora parâmetros inválidos ao ler', () => {
        const parsed = parseReservarParams(new URLSearchParams('checkIn=amanha&checkOut=2026-13-45&adults=abc'));
        expect(parsed).toEqual({});
    });

    it('padrão é hoje → amanhã com 2 adultos', () => {
        expect(defaultSearchValues(new Date('2026-11-11T12:00:00'))).toEqual({ checkIn: '2026-11-11', checkOut: '2026-11-12', adults: 2, children: 0, childrenAges: [] });
    });
});
