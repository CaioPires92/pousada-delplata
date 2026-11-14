import { describe, expect, it } from 'vitest';
import { parsePromotionInput } from '@/lib/promotions/validation';

const minimal = { name: 'Semana Santa', discountPercent: 10 };

describe('parsePromotionInput', () => {
    it('só nome e percentual são obrigatórios; demais campos ficam vazios', () => {
        const r = parsePromotionInput(minimal);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.data.active).toBe(true);
            expect(r.data.stackWithCoupons).toBe(false);
            expect(r.data.stackWithPromotions).toBe(false);
            expect(r.data.allowedCouponIds).toBeNull();
            expect(r.data.allowedPromotionIds).toBeNull();
            expect(r.data.allowedRoomTypeIds).toBeNull();
            expect(r.data.minDaysBeforeCheckIn).toBeNull();
            expect(r.data.maxDaysBeforeCheckIn).toBeNull();
            expect(r.data.stayStart).toBeNull();
            expect(r.data.stayEnd).toBeNull();
        }
    });

    it('não exige campos por tipo e ignora um "type" enviado', () => {
        // Antes: Última Hora exigia maxDays, Antecipada exigia minDays, Sazonal exigia as duas datas.
        expect(parsePromotionInput({ ...minimal, type: 'LAST_MINUTE' }).ok).toBe(true);
        expect(parsePromotionInput({ ...minimal, type: 'EARLY_BIRD' }).ok).toBe(true);
        expect(parsePromotionInput({ ...minimal, type: 'SEASONAL' }).ok).toBe(true);
        const r = parsePromotionInput({ ...minimal, type: 'QUALQUER' });
        expect(r.ok).toBe(true);
        expect(r.ok && 'type' in r.data).toBe(false);
        expect(r.ok && 'priority' in r.data).toBe(false);
    });

    it('aceita condições soltas e combinadas', () => {
        const r = parsePromotionInput({
            ...minimal,
            minDaysBeforeCheckIn: '2',
            maxDaysBeforeCheckIn: '5',
            stayStart: '2026-12-01',
            minNights: '2',
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.data.minDaysBeforeCheckIn).toBe(2);
            expect(r.data.maxDaysBeforeCheckIn).toBe(5);
            expect(r.data.stayStart).toEqual(new Date('2026-12-01T00:00:00Z'));
            expect(r.data.stayEnd).toBeNull();
            expect(r.data.minNights).toBe(2);
        }
        expect(parsePromotionInput({ ...minimal, maxDaysBeforeCheckIn: 0 }).ok).toBe(true); // 0 = próprio dia
    });

    it('exige nome e rejeita percentuais, datas e janelas inválidas', () => {
        expect(parsePromotionInput({ discountPercent: 10 }).ok).toBe(false);
        expect(parsePromotionInput({ ...minimal, discountPercent: 0 }).ok).toBe(false);
        expect(parsePromotionInput({ ...minimal, discountPercent: 101 }).ok).toBe(false);
        expect(parsePromotionInput({ name: 'x' }).ok).toBe(false);
        expect(parsePromotionInput({ ...minimal, stayStart: '2026-12-31', stayEnd: '2026-12-01' }).ok).toBe(false);
        expect(parsePromotionInput({ ...minimal, bookableFrom: '31/12/2026' }).ok).toBe(false);
        expect(parsePromotionInput({ ...minimal, minDaysBeforeCheckIn: 10, maxDaysBeforeCheckIn: 3 }).ok).toBe(false);
        expect(parsePromotionInput({ ...minimal, minNights: 0 }).ok).toBe(false);
        expect(parsePromotionInput({ ...minimal, maxDiscountAmount: -5 }).ok).toBe(false);
    });

    it('exclusive desliga qualquer acúmulo', () => {
        const r = parsePromotionInput({
            ...minimal,
            exclusive: true,
            stackWithCoupons: true,
            allowedCouponIds: ['c1'],
            stackWithPromotions: true,
            allowedPromotionIds: ['p1'],
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.data.exclusive).toBe(true);
            expect(r.data.stackWithCoupons).toBe(false);
            expect(r.data.stackWithPromotions).toBe(false);
            expect(r.data.allowedCouponIds).toBeNull();
            expect(r.data.allowedPromotionIds).toBeNull();
        }
    });

    it('acúmulo ligado sem lista = todos; com lista = só esses; lista vazia é erro', () => {
        const all = parsePromotionInput({ ...minimal, stackWithCoupons: true, allowedCouponIds: null, stackWithPromotions: true });
        expect(all.ok && all.data.stackWithCoupons).toBe(true);
        expect(all.ok && all.data.allowedCouponIds).toBeNull();
        expect(all.ok && all.data.stackWithPromotions).toBe(true);
        expect(all.ok && all.data.allowedPromotionIds).toBeNull();

        const some = parsePromotionInput({
            ...minimal,
            stackWithCoupons: true,
            allowedCouponIds: ['c1', 'c2', 'c1'],
            stackWithPromotions: true,
            allowedPromotionIds: ['p1'],
        });
        expect(some.ok && some.data.allowedCouponIds).toBe('["c1","c2"]');
        expect(some.ok && some.data.allowedPromotionIds).toBe('["p1"]');

        expect(parsePromotionInput({ ...minimal, stackWithCoupons: true, allowedCouponIds: [] }).ok).toBe(false);
        expect(parsePromotionInput({ ...minimal, stackWithPromotions: true, allowedPromotionIds: [] }).ok).toBe(false);
    });

    it('acúmulo desligado descarta listas enviadas', () => {
        const r = parsePromotionInput({ ...minimal, stackWithCoupons: false, allowedCouponIds: ['c1'], allowedPromotionIds: ['p1'] });
        expect(r.ok && r.data.allowedCouponIds).toBeNull();
        expect(r.ok && r.data.allowedPromotionIds).toBeNull();
    });

    it('serializa os quartos permitidos como JSON', () => {
        const r = parsePromotionInput({ ...minimal, allowedRoomTypeIds: ['a', 'b'] });
        expect(r.ok && r.data.allowedRoomTypeIds).toBe('["a","b"]');
    });

    it('audience: padrão "all", aceita "mobile" e rejeita valor inválido', () => {
        const def = parsePromotionInput(minimal);
        expect(def.ok && def.data.audience).toBe('all');
        const mobile = parsePromotionInput({ ...minimal, audience: 'mobile' });
        expect(mobile.ok && mobile.data.audience).toBe('mobile');
        expect(parsePromotionInput({ ...minimal, audience: 'tablet' }).ok).toBe(false);
    });

    it('showBadge: padrão true; aceita false', () => {
        const def = parsePromotionInput(minimal);
        expect(def.ok && def.data.showBadge).toBe(true);
        const hidden = parsePromotionInput({ ...minimal, showBadge: false });
        expect(hidden.ok && hidden.data.showBadge).toBe(false);
    });
});

describe('excludedStayDates (datas em que a promoção não vale)', () => {
    const parse = (excludedStayDates: unknown) => parsePromotionInput({ ...minimal, excludedStayDates });

    it('sem o campo ou vazio: sem exclusões (null)', () => {
        for (const value of [undefined, null, '', []]) {
            const r = parse(value);
            expect(r.ok && r.data.excludedStayDates).toBeNull();
        }
    });

    it('aceita {from,to}, {from} (um dia) e string AAAA-MM-DD; ordena e remove repetidas', () => {
        const r = parse([{ from: '2026-12-24', to: '2026-12-26' }, '2026-11-25', { from: '2026-11-25' }, { from: '2026-11-25', to: '2026-11-25' }]);
        expect(r.ok && JSON.parse(r.data.excludedStayDates as string)).toEqual([
            { from: '2026-11-25', to: '2026-11-25' },
            { from: '2026-12-24', to: '2026-12-26' },
        ]);
    });

    it('rejeita data inválida, fim antes do início, formato errado e listas enormes', () => {
        expect(parse([{ from: '25/11/2026' }]).ok).toBe(false);
        expect(parse([{ from: '2026-13-40' }]).ok).toBe(false);
        expect(parse([{ from: '2026-02-30' }]).ok).toBe(false);
        expect(parse([{ from: '2026-11-26', to: '2026-11-25' }]).ok).toBe(false);
        expect(parse('2026-11-25').ok).toBe(false);
        expect(parse(Array.from({ length: 201 }, (_, i) => ({ from: `2027-01-${String((i % 28) + 1).padStart(2, '0')}`, to: `2027-02-${String((i % 28) + 1).padStart(2, '0')}` }))).ok).toBe(false);
    });
});

describe('daysOfWeek (dias da semana em que a promoção vale)', () => {
    const parse = (daysOfWeek: unknown) => parsePromotionInput({ ...minimal, daysOfWeek });

    it('ausente ou com os 7 dias = todos os dias (null)', () => {
        for (const value of [undefined, null, '', [0, 1, 2, 3, 4, 5, 6]]) {
            const r = parse(value);
            expect(r.ok && r.data.daysOfWeek).toBeNull();
        }
    });

    it('guarda só os dias marcados, ordenados e sem repetição (aceita números em texto)', () => {
        const r = parse([6, '5', 5]);
        expect(r.ok && r.data.daysOfWeek).toBe('[5,6]');
    });

    it('rejeita lista vazia, dia fora de 0-6, não inteiro e formato errado', () => {
        expect(parse([]).ok).toBe(false);
        expect(parse([7]).ok).toBe(false);
        expect(parse([-1]).ok).toBe(false);
        expect(parse([1.5]).ok).toBe(false);
        expect(parse(['seg']).ok).toBe(false);
        expect(parse('5,6').ok).toBe(false);
    });
});
