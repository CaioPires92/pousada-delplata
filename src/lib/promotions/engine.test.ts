import { describe, expect, it } from 'vitest';
import {
    calculatePromotionDiscount,
    daysBetween,
    defaultBadgeLabel,
    DIRECT_BOOKING_BADGE_TAG,
    HIDDEN_PROMOTION_PUBLIC_NAME,
    resolveBestPromotion,
    toPublicPromotion,
    stripPercentFromLabel,
    todayDayKey,
    type PromotionRule,
} from '@/lib/promotions/engine';

function rule(overrides: Partial<PromotionRule> = {}): PromotionRule {
    return {
        id: 'p1',
        name: 'Promo',
        badgeLabel: null,
        type: 'CUSTOM',
        active: true,
        discountPercent: 10,
        maxDiscountAmount: null,
        minDaysBeforeCheckIn: null,
        maxDaysBeforeCheckIn: null,
        stayStart: null,
        stayEnd: null,
        bookableFrom: null,
        bookableUntil: null,
        minNights: null,
        allowedRoomTypeIds: [],
        stackWithCoupons: false,
        allowedCouponIds: null,
        stackWithPromotions: false,
        allowedPromotionIds: null,
        exclusive: false,
        audience: 'all',
        showBadge: true,
        createdAt: 0,
        ...overrides,
    };
}

const base = {
    bookingDayKey: '2026-11-10',
    checkIn: '2026-11-12',
    checkOut: '2026-11-14',
    roomTypeId: 'room-1',
    eligibleAmount: 1000,
};

describe('todayDayKey / daysBetween', () => {
    it('usa o fuso de São Paulo (21h em SP ainda é o mesmo dia, mesmo já sendo dia seguinte em UTC)', () => {
        expect(todayDayKey(new Date('2026-11-11T00:30:00Z'))).toBe('2026-11-10');
        expect(todayDayKey(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-11');
    });

    it('conta dias de calendário', () => {
        expect(daysBetween('2026-11-10', '2026-11-10')).toBe(0);
        expect(daysBetween('2026-11-10', '2026-11-12')).toBe(2);
        expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
    });
});

describe('resolveBestPromotion', () => {
    it('Última Hora: elegível até X dias antes, inclusive 0 dias (próprio dia)', () => {
        const p = rule({ maxDaysBeforeCheckIn: 2 });
        expect(resolveBestPromotion({ ...base, promotions: [p] })?.discountAmount).toBe(100);
        expect(resolveBestPromotion({ ...base, promotions: [p], checkIn: '2026-11-13', checkOut: '2026-11-14' })).toBeNull();
        expect(
            resolveBestPromotion({ ...base, promotions: [rule({ maxDaysBeforeCheckIn: 0 })], checkIn: '2026-11-10', checkOut: '2026-11-11' })
        ).not.toBeNull();
    });

    it('Early Bird: exige antecedência mínima', () => {
        const p = rule({ type: 'EARLY_BIRD', minDaysBeforeCheckIn: 30, discountPercent: 15 });
        expect(resolveBestPromotion({ ...base, promotions: [p] })).toBeNull();
        const far = resolveBestPromotion({ ...base, promotions: [p], checkIn: '2026-12-20', checkOut: '2026-12-22' });
        expect(far?.discountAmount).toBe(150);
        expect(far?.badgeLabel).toBe('🐦 Reserva Antecipada: 15% OFF');
    });

    it('Sazonal: só as noites dentro de [stayStart, stayEnd] recebem o desconto (noite a noite)', () => {
        const p = rule({ type: 'SEASONAL', stayStart: '2026-11-12', stayEnd: '2026-11-13' });
        expect(resolveBestPromotion({ ...base, promotions: [p] })?.discountAmount).toBe(100); // noites 12 e 13: 10% de 1000
        // noites 12, 13 e 14 (R$ 1000 / 3 cada): só 2 de 3 recebem
        expect(resolveBestPromotion({ ...base, promotions: [p], checkOut: '2026-11-15' })?.discountAmount).toBe(66.67);
        // noites 11 e 12: só a de 12 recebe
        expect(resolveBestPromotion({ ...base, promotions: [p], checkIn: '2026-11-11', checkOut: '2026-11-13' })?.discountAmount).toBe(50);
        // nenhuma noite dentro do período: sem promoção
        expect(resolveBestPromotion({ ...base, promotions: [p], checkIn: '2026-11-20', checkOut: '2026-11-22' })).toBeNull();
    });

    it('ignora inativa, quarto não permitido, minNights e janela de venda', () => {
        expect(resolveBestPromotion({ ...base, promotions: [rule({ active: false })] })).toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [rule({ allowedRoomTypeIds: ['x'] })] })).toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [rule({ allowedRoomTypeIds: ['room-1'] })] })).not.toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [rule({ minNights: 3 })] })).toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [rule({ bookableUntil: '2026-11-09' })] })).toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [rule({ bookableFrom: '2026-11-11' })] })).toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [rule({ bookableFrom: '2026-11-10', bookableUntil: '2026-11-10' })] })).not.toBeNull();
    });

    it('escolhe o maior desconto em R$ e nunca soma promoções', () => {
        const small = rule({ id: 'a', discountPercent: 10 });
        const big = rule({ id: 'b', discountPercent: 20 });
        const best = resolveBestPromotion({ ...base, promotions: [small, big] });
        expect(best?.id).toBe('b');
        expect(best?.discountAmount).toBe(200);
    });

    it('respeita o teto em R$ e, em empate de desconto, vence a promoção mais recente', () => {
        const capped = rule({ id: 'a', discountPercent: 50, maxDiscountAmount: 100, createdAt: 1000 });
        const equal = rule({ id: 'b', discountPercent: 10, createdAt: 2000 });
        expect(resolveBestPromotion({ ...base, promotions: [capped, equal] })?.id).toBe('b');
        expect(resolveBestPromotion({ ...base, promotions: [{ ...capped, createdAt: 3000 }, equal] })?.id).toBe('a');
    });

    it('condições são todas opcionais e combináveis (E)', () => {
        // sem nenhuma condição: vale para qualquer reserva futura
        expect(resolveBestPromotion({ ...base, promotions: [rule()] })).not.toBeNull();
        // só "estadia a partir de" (sem fim)
        const openEnded = rule({ stayStart: '2026-11-12' });
        expect(resolveBestPromotion({ ...base, promotions: [openEnded], checkOut: '2027-01-10' })).not.toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [openEnded], checkIn: '2026-11-10', checkOut: '2026-11-11' })).toBeNull(); // nenhuma noite dentro
        // só "estadia até" (sem início)
        const untilOnly = rule({ stayEnd: '2026-11-13' });
        expect(resolveBestPromotion({ ...base, promotions: [untilOnly] })).not.toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [untilOnly], checkIn: '2026-11-14', checkOut: '2026-11-16' })).toBeNull(); // nenhuma noite dentro
        // janela de antecedência com mínimo E máximo (entre 2 e 5 dias)
        const window = rule({ minDaysBeforeCheckIn: 2, maxDaysBeforeCheckIn: 5 });
        expect(resolveBestPromotion({ ...base, promotions: [window] })).not.toBeNull(); // 2 dias
        expect(resolveBestPromotion({ ...base, promotions: [window], checkIn: '2026-11-11', checkOut: '2026-11-12' })).toBeNull(); // 1 dia
        expect(resolveBestPromotion({ ...base, promotions: [window], checkIn: '2026-11-20', checkOut: '2026-11-22' })).toBeNull(); // 10 dias
        // todas juntas: uma condição falhando derruba a promoção
        const all = rule({ minNights: 2, allowedRoomTypeIds: ['room-1'], stayStart: '2026-11-01', bookableUntil: '2026-11-30' });
        expect(resolveBestPromotion({ ...base, promotions: [all] })).not.toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [all], roomTypeId: 'room-2' })).toBeNull();
    });

    it('promoção legada mantém o rótulo padrão do tipo; CUSTOM usa o rótulo genérico', () => {
        expect(resolveBestPromotion({ ...base, promotions: [rule({ type: 'LAST_MINUTE' })] })?.badgeLabel).toBe('🔥 Oferta de Última Hora: 10% OFF');
        expect(resolveBestPromotion({ ...base, promotions: [rule()] })?.badgeLabel).toBe('🏷️ Oferta Especial: 10% OFF');
    });

    describe('acúmulo entre promoções', () => {
        const stacker = (id: string, percent: number, overrides: Partial<PromotionRule> = {}) =>
            rule({ id, name: `Promo ${id}`, discountPercent: percent, stackWithPromotions: true, ...overrides });

        it('acumula em cascata quando as duas permitem (10% + 10% = 19%)', () => {
            const r = resolveBestPromotion({ ...base, promotions: [stacker('a', 10), stacker('b', 10)] });
            expect(r?.items).toHaveLength(2);
            expect(r?.discountAmount).toBe(190);
            expect(r?.discountPercent).toBe(19);
            expect(r?.name).toBe('Promo a + Promo b');
            expect(r?.items.map((i) => i.discountAmount)).toEqual([100, 90]);
        });

        it('exige consentimento mútuo: se só uma permite, vale a melhor isolada', () => {
            const r = resolveBestPromotion({
                ...base,
                promotions: [stacker('a', 10), rule({ id: 'b', discountPercent: 15, stackWithPromotions: false })],
            });
            expect(r?.items.map((i) => i.id)).toEqual(['b']);
            expect(r?.discountAmount).toBe(150);
        });

        it('respeita a lista de promoções aceitas dos dois lados', () => {
            const a = stacker('a', 10, { allowedPromotionIds: ['b'] });
            const b = stacker('b', 10, { allowedPromotionIds: ['a'] });
            const c = stacker('c', 10, { allowedPromotionIds: null });
            // a só aceita b; b só aceita a; c aceita todas mas a/b não aceitam c
            const r = resolveBestPromotion({ ...base, promotions: [a, b, c] });
            expect(r?.items.map((i) => i.id).sort()).toEqual(['a', 'b']);
        });

        it('exclusive nunca acumula, nem com quem aceita tudo', () => {
            const r = resolveBestPromotion({
                ...base,
                promotions: [stacker('a', 10), stacker('b', 30, { exclusive: true })],
            });
            expect(r?.items.map((i) => i.id)).toEqual(['b']);
            expect(r?.exclusive).toBe(true);
        });

        it('acumular compensa mesmo com percentual menor isolado, mas não com teto que anula o ganho', () => {
            const big = rule({ id: 'big', discountPercent: 20, stackWithPromotions: false });
            const s1 = stacker('s1', 12);
            const s2 = stacker('s2', 12);
            // 12% + 12% em cascata = 22,56% > 20% isolado
            expect(resolveBestPromotion({ ...base, promotions: [big, s1, s2] })?.items).toHaveLength(2);
            // 5% + 5% = 9,75% < 20% isolado
            expect(resolveBestPromotion({ ...base, promotions: [big, stacker('t1', 5), stacker('t2', 5)] })?.id).toBe('big');
        });

        it('teto em R$ vale sobre a parcela de cada promoção', () => {
            const r = resolveBestPromotion({
                ...base,
                promotions: [stacker('a', 20, { maxDiscountAmount: 50 }), stacker('b', 10)],
            });
            // a: 20% de 1000 = 200 → teto 50; b: 10% de 950 = 95
            expect(r?.discountAmount).toBe(145);
        });

        it('resultado combinado só permite cupom se todas permitirem e intersecta as listas', () => {
            const a = stacker('a', 10, { stackWithCoupons: true, allowedCouponIds: ['c1', 'c2'] });
            const b = stacker('b', 10, { stackWithCoupons: true, allowedCouponIds: ['c2', 'c3'] });
            const both = resolveBestPromotion({ ...base, promotions: [a, b] });
            expect(both?.stackWithCoupons).toBe(true);
            expect(both?.allowedCouponIds).toEqual(['c2']);

            const mixed = resolveBestPromotion({ ...base, promotions: [a, stacker('b', 10)] });
            expect(mixed?.stackWithCoupons).toBe(false);

            const open = resolveBestPromotion({
                ...base,
                promotions: [stacker('a', 10, { stackWithCoupons: true }), stacker('b', 10, { stackWithCoupons: true })],
            });
            expect(open?.allowedCouponIds).toBeNull();
        });

        it('com muitas candidatas continua determinístico', () => {
            const many = Array.from({ length: 20 }, (_, i) => stacker(`p${String(i).padStart(2, '0')}`, 2 + i * 0.1));
            const first = resolveBestPromotion({ ...base, promotions: many });
            const second = resolveBestPromotion({ ...base, promotions: [...many].reverse() });
            expect(first?.items.map((i) => i.id)).toEqual(second?.items.map((i) => i.id));
        });
    });

    it('exclusive desliga stackWithCoupons no resultado', () => {
        const p = rule({ exclusive: true, stackWithCoupons: true });
        const r = resolveBestPromotion({ ...base, promotions: [p] });
        expect(r?.exclusive).toBe(true);
        expect(r?.stackWithCoupons).toBe(false);
    });

    it('usa o badge customizado quando informado', () => {
        const r = resolveBestPromotion({ ...base, promotions: [rule({ badgeLabel: 'Black Friday' })] });
        expect(r?.badgeLabel).toBe('Black Friday');
    });

    it('base zero não gera promoção', () => {
        expect(resolveBestPromotion({ ...base, promotions: [rule()], eligibleAmount: 0 })).toBeNull();
    });
});

describe('calculatePromotionDiscount / defaultBadgeLabel', () => {
    it('arredonda para centavos e limita ao valor elegível', () => {
        expect(calculatePromotionDiscount({ discountPercent: 12.5, maxDiscountAmount: null }, 333.33)).toBe(41.67);
        expect(calculatePromotionDiscount({ discountPercent: 150, maxDiscountAmount: null }, 100)).toBe(100);
    });

    it('rótulos padrão por tipo', () => {
        expect(defaultBadgeLabel('LAST_MINUTE', 10)).toBe('🔥 Oferta de Última Hora: 10% OFF');
        expect(defaultBadgeLabel('SEASONAL', 7.5)).toBe('🌿 Oferta de Temporada: 7.5% OFF');
    });
});

describe('audience (Mobile rate)', () => {
    it('promoção "all" vale em qualquer dispositivo', () => {
        expect(resolveBestPromotion({ ...base, promotions: [rule()], isMobile: false })).not.toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [rule()], isMobile: true })).not.toBeNull();
    });

    it('promoção "mobile" só vale quando a reserva vem de celular', () => {
        const mobileOnly = rule({ audience: 'mobile' });
        expect(resolveBestPromotion({ ...base, promotions: [mobileOnly], isMobile: true })?.discountAmount).toBe(100);
        expect(resolveBestPromotion({ ...base, promotions: [mobileOnly], isMobile: false })).toBeNull();
        expect(resolveBestPromotion({ ...base, promotions: [mobileOnly] })).toBeNull();
    });

    it('no desktop, as demais promoções continuam valendo sem a mobile', () => {
        const r = resolveBestPromotion({
            ...base,
            promotions: [rule({ id: 'a', discountPercent: 5 }), rule({ id: 'm', discountPercent: 10, audience: 'mobile' })],
            isMobile: false,
        });
        expect(r?.items.map((i) => i.id)).toEqual(['a']);
    });
});

describe('showBadge / toPublicPromotion', () => {
    const stack = (id: string, percent: number, over: Partial<PromotionRule> = {}) =>
        rule({ id, name: `Interna ${id}`, discountPercent: percent, stackWithPromotions: true, ...over });

    it('o item resolvido carrega showBadge sem alterar o valor do desconto', () => {
        const r = resolveBestPromotion({ ...base, promotions: [stack('a', 20, { showBadge: false }), stack('b', 10)] });
        expect(r?.discountAmount).toBe(280); // 20% e depois 10% sobre o restante
        expect(r?.items.map((i) => [i.id, i.showBadge])).toEqual([['a', false], ['b', true]]);
    });

    it('uma única promoção visível, sem ocultas e com o % igual ao do total: nada muda (etiqueta digitada preservada)', () => {
        const r = resolveBestPromotion({ ...base, promotions: [rule({ badgeLabel: '🔥 Super oferta 10% OFF' })] })!;
        expect(toPublicPromotion(r)).toBe(r);
    });

    it('promoções ocultas viram UMA linha neutra e o nome interno some', () => {
        const r = resolveBestPromotion({
            ...base,
            promotions: [stack('g', 20, { showBadge: false, name: 'Genius dinâmico (interno)' }), stack('n', 5, { showBadge: false, name: 'Não reembolsável (interno)' }), stack('e', 10)],
        })!;
        const pub = toPublicPromotion(r);

        expect(pub.items.map((i) => i.name)).toEqual(['Interna e', HIDDEN_PROMOTION_PUBLIC_NAME]);
        expect(JSON.stringify(pub)).not.toMatch(/Genius|reembolsável/i);
        // O total descontado é exatamente o mesmo.
        const sum = pub.items.reduce((acc, i) => acc + i.discountAmount, 0);
        expect(Math.round(sum * 100)).toBe(Math.round(r.discountAmount * 100));
        expect(pub.discountAmount).toBe(r.discountAmount);
        expect(pub.items.at(-1)?.showBadge).toBe(false);
    });

    it('com todas ocultas o selo é só a categoria Reserva direta (sem nome de promoção)', () => {
        const r = resolveBestPromotion({ ...base, promotions: [stack('a', 20, { showBadge: false })] })!;
        const pub = toPublicPromotion(r);
        expect(pub.badgeLabel).toBe(`${DIRECT_BOOKING_BADGE_TAG}: 20% OFF`);
        expect(pub.items.filter((i) => i.showBadge)).toHaveLength(0);
        expect(pub.discountAmount).toBe(200);
    });
});

describe('noite a noite: datas removidas, dias da semana e valores por noite', () => {
    const nov = { stayStart: '2026-11-01', stayEnd: '2026-11-30' };
    const range = (from: string, to = from) => ({ from, to });
    const nights = (days: string[], amount: number) => days.map((day) => ({ day, amount }));
    const quote = (p: PromotionRule | PromotionRule[], checkIn: string, checkOut: string, extra: Record<string, unknown> = {}) =>
        resolveBestPromotion({ ...base, promotions: Array.isArray(p) ? p : [p], checkIn, checkOut, ...extra });

    it('vale em novembro inteiro, menos na noite de 25/11: só essa noite perde o desconto', () => {
        const p = rule({ ...nov, excludedStayRanges: [range('2026-11-25')] });
        // estadia 24→26 = noites 24 e 25 (R$ 500 cada): desconto só na de 24
        const result = quote(p, '2026-11-24', '2026-11-26', { eligibleAmount: 1000, nightAmounts: nights(['2026-11-24', '2026-11-25'], 500) });
        expect(result?.discountAmount).toBe(50);
        // só a noite de 25: nenhuma noite elegível → sem promoção
        expect(quote(p, '2026-11-25', '2026-11-26')).toBeNull();
        // dorme 24 e sai no dia 25: a noite de 25 não é usada, então tudo é elegível
        expect(quote(p, '2026-11-24', '2026-11-25')?.discountAmount).toBe(100);
        // antes e depois do dia removido: desconto cheio
        expect(quote(p, '2026-11-20', '2026-11-22')?.discountAmount).toBe(100);
        expect(quote(p, '2026-11-26', '2026-11-28')?.discountAmount).toBe(100);
    });

    it('usa o preço real de cada noite (noite cara removida não entra no desconto)', () => {
        const p = rule({ ...nov, excludedStayRanges: [range('2026-11-14')] }); // sábado caro removido
        const days = ['2026-11-13', '2026-11-14', '2026-11-15'];
        const result = quote(p, '2026-11-13', '2026-11-16', {
            eligibleAmount: 1300,
            nightAmounts: [{ day: days[0], amount: 300 }, { day: days[1], amount: 700 }, { day: days[2], amount: 300 }],
        });
        expect(result?.discountAmount).toBe(60); // 10% de (300 + 300); os R$ 700 da noite removida ficam de fora
        expect(result?.discountPercent).toBe(10); // percentual da promoção (único), não o efetivo sobre o total
    });

    it('aceita intervalos (as duas pontas são inclusivas) e vários intervalos', () => {
        const p = rule({ ...nov, excludedStayRanges: [range('2026-11-14', '2026-11-16'), range('2026-11-25')] });
        expect(quote(p, '2026-11-13', '2026-11-14')?.discountAmount).toBe(100); // só a noite de 13
        expect(quote(p, '2026-11-16', '2026-11-17')).toBeNull(); // noite de 16 (última do intervalo)
        expect(quote(p, '2026-11-17', '2026-11-19')?.discountAmount).toBe(100); // entre os intervalos
        expect(quote(p, '2026-11-12', '2026-11-18')?.discountAmount).toBe(50); // 6 noites; 14, 15 e 16 removidas: 3 de 6 noites = 10% de R$ 500
    });

    it('sem exclusões (ausente ou vazio) o comportamento não muda', () => {
        expect(quote(rule({ ...nov }), '2026-11-24', '2026-11-26')?.discountAmount).toBe(100);
        expect(quote(rule({ ...nov, excludedStayRanges: [] }), '2026-11-24', '2026-11-26')?.discountAmount).toBe(100);
    });

    it('dias da semana: só as noites dos dias marcados recebem o desconto', () => {
        // 2026-11-13 = sexta, 14 = sábado, 15 = domingo
        const weekend = rule({ daysOfWeek: [5, 6] }); // sexta e sábado
        const days = ['2026-11-13', '2026-11-14', '2026-11-15'];
        const result = quote(weekend, '2026-11-13', '2026-11-16', { eligibleAmount: 900, nightAmounts: nights(days, 300) });
        expect(result?.discountAmount).toBe(60); // sexta e sábado: 10% de 600
        expect(quote(weekend, '2026-11-15', '2026-11-16')).toBeNull(); // só domingo
        // vazio ou ausente = todos os dias
        expect(quote(rule({ daysOfWeek: [] }), '2026-11-15', '2026-11-16')?.discountAmount).toBe(100);
        expect(quote(rule({ daysOfWeek: null }), '2026-11-15', '2026-11-16')?.discountAmount).toBe(100);
    });

    it('a promoção removida numa noite cede lugar a outra elegível só naquela noite', () => {
        const genius = rule({ id: 'genius', discountPercent: 20, excludedStayRanges: [range('2026-11-25')] });
        const mobile = rule({ id: 'mobile', discountPercent: 10 });
        const days = ['2026-11-24', '2026-11-25'];
        const result = quote([genius, mobile], '2026-11-24', '2026-11-26', { eligibleAmount: 1000, nightAmounts: nights(days, 500) });
        // noite 24: Genius 20% = 100 (vence a Mobile); noite 25: só a Mobile 10% = 50
        expect(result?.discountAmount).toBe(150);
        expect(result?.items.map((item) => [item.id, item.discountAmount])).toEqual([['genius', 100], ['mobile', 50]]);
        expect(quote([genius, mobile], '2026-11-25', '2026-11-26')?.id).toBe('mobile');
    });

    it('acúmulo é decidido noite a noite: na noite sem uma das promoções, só vale a outra', () => {
        const stackable = { stackWithPromotions: true };
        const genius = rule({ id: 'genius', discountPercent: 20, ...stackable, excludedStayRanges: [range('2026-11-25')] });
        const mobile = rule({ id: 'mobile', discountPercent: 10, ...stackable });
        const days = ['2026-11-24', '2026-11-25'];
        const result = quote([genius, mobile], '2026-11-24', '2026-11-26', { eligibleAmount: 1000, nightAmounts: nights(days, 500) });
        // noite 24: 20% + 10% em cascata = 500 - 100 = 400; 400 * 10% = 40 → 140; noite 25: só Mobile = 50
        expect(result?.discountAmount).toBe(190);
        expect(result?.items.map((item) => [item.id, item.discountAmount])).toEqual([['genius', 100], ['mobile', 90]]);
    });

    it('teto em R$ vale para o total da promoção na reserva, não por noite', () => {
        const capped = rule({ id: 'cap', maxDiscountAmount: 80, excludedStayRanges: [range('2026-11-25')] });
        const days = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];
        const result = quote(capped, '2026-11-23', '2026-11-27', { eligibleAmount: 2000, nightAmounts: nights(days, 500) });
        // 3 noites elegíveis de R$ 500: 10% = 150, limitado a 80
        expect(result?.discountAmount).toBe(80);
    });
});


describe('etiqueta pública mostra o percentual REAL da reserva', () => {
    const stack = (id: string, percent: number, over: Partial<PromotionRule> = {}) =>
        rule({ id, name: `Interna ${id}`, discountPercent: percent, stackWithPromotions: true, ...over });
    const resolve = (promotions: PromotionRule[], extra: Record<string, unknown> = {}) =>
        resolveBestPromotion({ ...base, promotions, ...extra })!;

    it('caso real: R$ 449 com Genius 20% + Última hora 10% + Não reembolsável 5% (ocultas) vira "31,6% OFF"', () => {
        const r = resolve(
            [
                stack('genius', 20, { showBadge: false }),
                stack('nr', 5, { showBadge: false }),
                stack('last', 10, { name: 'Última hora 10%', badgeLabel: '🔥 Última hora: 10% OFF' }),
            ],
            { checkIn: '2026-11-12', checkOut: '2026-11-13', eligibleAmount: 449 }
        );
        const pub = toPublicPromotion(r);
        expect(449 - pub.discountAmount).toBeCloseTo(307.12, 1);
        expect(pub.badgeLabel).toBe('🔥 Última hora + 🏡 Reserva direta: 31,6% OFF');
        expect(pub.discountPercent).toBe(31.6);
        // a linha da promoção visível perde o "10%" do nome; as ocultas viram a linha neutra
        expect(pub.items.map((i) => i.name)).toEqual(['Última hora', HIDDEN_PROMOTION_PUBLIC_NAME]);
        // o total descontado não muda
        expect(pub.discountAmount).toBe(r.discountAmount);
    });

    it('duas promoções visíveis acumuladas viram uma etiqueta só com o percentual total', () => {
        const r = resolve([
            stack('a', 10, { name: 'Reserva antecipada 10%', badgeLabel: '🐦 Reserva antecipada: 10% OFF' }),
            stack('b', 10, { name: 'Mobile 10%', badgeLabel: '📱 Tarifa mobile: 10% OFF' }),
        ]);
        const pub = toPublicPromotion(r);
        expect(pub.badgeLabel).toBe('🐦 Reserva antecipada + 📱 Tarifa mobile: 19% OFF'); // 10% e depois 10% do saldo
        expect(pub.items.map((i) => i.name)).toEqual(['Reserva antecipada', 'Mobile']);
    });

    it('o percentual é arredondado na primeira casa (R$ 449 → R$ 307,12 é 31,599%, mostrado como 31,6%)', () => {
        const r = resolve([stack('a', 20, { showBadge: false }), stack('b', 10, { badgeLabel: 'Oferta B: 10% OFF' }), stack('c', 5, { showBadge: false })], { eligibleAmount: 449, checkOut: '2026-11-13', checkIn: '2026-11-12' });
        expect(toPublicPromotion(r).badgeLabel).toBe('Oferta B + 🏡 Reserva direta: 31,6% OFF');
    });

    it('etiqueta sem percentual escrito ganha o percentual real no fim', () => {
        const r = resolve([stack('g', 20, { showBadge: false }), stack('x', 10, { badgeLabel: 'Oferta especial' })]);
        expect(toPublicPromotion(r).badgeLabel).toBe('Oferta especial + 🏡 Reserva direta: 28% OFF');
    });

    it('promoção que vale só em parte das noites mostra o percentual efetivo, não o nominal', () => {
        const p = rule({ stayStart: '2026-11-12', stayEnd: '2026-11-12', badgeLabel: '🌿 Temporada: 10% OFF' });
        // noites 12 e 13 (R$ 1000 no total): só a noite de 12 recebe → R$ 50 = 5% do total
        const r = resolve([p], { checkOut: '2026-11-14' });
        expect(r.discountAmount).toBe(50);
        expect(toPublicPromotion(r).badgeLabel).toBe('🌿 Temporada: 5% OFF');
    });

    it('Genius + Não reembolsável (categoria Reserva direta) aparecem como UMA etiqueta e UMA linha, nunca duas', () => {
        const r = resolve([stack('g', 20, { showBadge: false, name: 'Genius' }), stack('n', 5, { showBadge: false, name: 'Não reembolsável' })]);
        const pub = toPublicPromotion(r);
        expect(pub.badgeLabel).toBe('🏡 Reserva direta: 24% OFF'); // 20% e depois 5% do saldo
        expect(pub.items).toHaveLength(1);
        expect(pub.items[0].name).toBe(HIDDEN_PROMOTION_PUBLIC_NAME);
        expect(pub.items[0].discountAmount).toBe(240); // a soma das duas
    });

    it('qualquer promoção nova com a etiqueta oculta entra sozinha na mesma categoria', () => {
        const r = resolve([
            stack('g', 20, { showBadge: false }),
            stack('n', 5, { showBadge: false }),
            stack('novo', 3, { showBadge: false, name: 'Convênio' }),
            stack('v', 10, { badgeLabel: '🔥 Última hora: 10% OFF' }),
        ]);
        const pub = toPublicPromotion(r);
        expect(pub.items.map((i) => i.name)).toEqual(['Interna v', HIDDEN_PROMOTION_PUBLIC_NAME]);
        expect(pub.badgeLabel).toMatch(/^🔥 Última hora \+ 🏡 Reserva direta: /);
        expect(JSON.stringify(pub)).not.toMatch(/Convênio/);
    });

    it('stripPercentFromLabel tira o percentual escrito à mão e nada além disso', () => {
        expect(stripPercentFromLabel('🔥 Última hora: 10% OFF')).toBe('🔥 Última hora');
        expect(stripPercentFromLabel('🐦 Reserva Antecipada: 15,5% OFF')).toBe('🐦 Reserva Antecipada');
        expect(stripPercentFromLabel('Mobile 10%')).toBe('Mobile');
        expect(stripPercentFromLabel('Semana Santa 2027')).toBe('Semana Santa 2027');
        expect(stripPercentFromLabel('10% OFF')).toBe('');
        expect(stripPercentFromLabel('Oferta - 20% de desconto')).toBe('Oferta');
    });
});
