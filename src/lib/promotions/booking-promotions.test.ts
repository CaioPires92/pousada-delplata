import { describe, expect, it } from 'vitest';
import { resolveBestPromotion, toPublicPromotion, type PromotionRule } from '@/lib/promotions/engine';

/**
 * As 5 promoções da pousada, configuradas como no Extranet do Booking (levantamento de 11/11/2026).
 * Servem de teste de regressão do cálculo noite a noite com acúmulo.
 */
const TRIPLO = 'room-triplo';
const KING = 'room-king';

function promo(overrides: Partial<PromotionRule> & Pick<PromotionRule, 'id' | 'name' | 'discountPercent'>): PromotionRule {
    return {
        badgeLabel: null,
        type: 'CUSTOM',
        active: true,
        maxDiscountAmount: null,
        minDaysBeforeCheckIn: null,
        maxDaysBeforeCheckIn: null,
        stayStart: null,
        stayEnd: null,
        excludedStayRanges: [],
        daysOfWeek: null,
        bookableFrom: null,
        bookableUntil: null,
        minNights: null,
        allowedRoomTypeIds: [],
        stackWithCoupons: false,
        allowedCouponIds: null,
        stackWithPromotions: true, // como no Booking: acumulam entre si
        allowedPromotionIds: null,
        exclusive: false,
        audience: 'all',
        showBadge: true,
        createdAt: 0,
        ...overrides,
    };
}

const early = promo({ id: 'early', name: 'Reserva antecipada 10%', badgeLabel: '🐦 Reserva antecipada: 10% OFF', discountPercent: 10, minDaysBeforeCheckIn: 30, stayStart: '2026-11-05', stayEnd: '2027-02-05', bookableFrom: '2026-11-05' });
const last = promo({ id: 'last', name: 'Última hora 10%', badgeLabel: '🔥 Última hora: 10% OFF', discountPercent: 10, maxDaysBeforeCheckIn: 3, stayStart: '2026-11-05', stayEnd: '2027-02-05', bookableFrom: '2026-11-05' });
const mobile = promo({ id: 'mobile', name: 'Mobile 10%', badgeLabel: '📱 Tarifa mobile: 10% OFF', discountPercent: 10, audience: 'mobile', excludedStayRanges: [{ from: '2026-11-14', to: '2026-11-14' }] });
const genius = promo({ id: 'genius', name: 'Genius dinâmico', discountPercent: 20, showBadge: false, excludedStayRanges: [{ from: '2026-11-14', to: '2026-11-14' }] });
const naoReembolsavel = promo({ id: 'nr', name: 'Não reembolsável 5%', discountPercent: 5, showBadge: false, allowedRoomTypeIds: [TRIPLO] });
const ALL = [early, last, mobile, genius, naoReembolsavel];

function quote(opts: { checkIn: string; checkOut: string; perNight: number; roomTypeId?: string; isMobile?: boolean; bookingDayKey?: string }) {
    const nights: string[] = [];
    for (let d = new Date(`${opts.checkIn}T00:00:00Z`); d < new Date(`${opts.checkOut}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
        nights.push(d.toISOString().slice(0, 10));
    }
    return resolveBestPromotion({
        promotions: ALL,
        bookingDayKey: opts.bookingDayKey ?? '2026-11-11',
        checkIn: opts.checkIn,
        checkOut: opts.checkOut,
        roomTypeId: opts.roomTypeId ?? TRIPLO,
        isMobile: opts.isMobile ?? false,
        eligibleAmount: opts.perNight * nights.length,
        nightAmounts: nights.map((day) => ({ day, amount: opts.perNight })),
    });
}

const names = (r: ReturnType<typeof quote>) => r?.items.map((item) => item.id).sort();

describe('promoções da pousada (como no Booking)', () => {
    it('Triplo, reserva com 30+ dias, no computador: Genius + Antecipada + Não reembolsável', () => {
        const r = quote({ checkIn: '2026-12-11', checkOut: '2026-12-13', perNight: 599 });
        expect(names(r)).toEqual(['early', 'genius', 'nr']);
        expect(1198 - (r?.discountAmount ?? 0)).toBeCloseTo(819.43, 1); // 1198 × 0,8 × 0,9 × 0,95
    });

    it('no celular entra também a tarifa Mobile', () => {
        const r = quote({ checkIn: '2026-12-11', checkOut: '2026-12-13', perNight: 599, isMobile: true });
        expect(names(r)).toEqual(['early', 'genius', 'mobile', 'nr']);
        expect(1198 - (r?.discountAmount ?? 0)).toBeCloseTo(737.5, 0); // × 0,8 × 0,9 × 0,9 × 0,95
    });

    it('King não tem o plano Não reembolsável (só o Triplo)', () => {
        const r = quote({ checkIn: '2026-12-11', checkOut: '2026-12-13', perNight: 799, roomTypeId: KING });
        expect(names(r)).toEqual(['early', 'genius']);
        expect(1598 - (r?.discountAmount ?? 0)).toBeCloseTo(1150.56, 1); // × 0,8 × 0,9
    });

    it('reserva sem antecedência de 30 dias nem de 3 dias: só Genius + Não reembolsável', () => {
        const r = quote({ checkIn: '2026-11-20', checkOut: '2026-11-22', perNight: 699 }); // 9 dias de antecedência
        expect(names(r)).toEqual(['genius', 'nr']);
    });

    it('última hora (0 a 3 dias): Genius + Última hora + Não reembolsável', () => {
        const r = quote({ checkIn: '2026-11-12', checkOut: '2026-11-14', perNight: 699 }); // 1 dia de antecedência
        expect(names(r)).toEqual(['genius', 'last', 'nr']);
        expect(quote({ checkIn: '2026-11-11', checkOut: '2026-11-12', perNight: 699 })?.items.map((i) => i.id)).toContain('last'); // no próprio dia
    });

    it('noite de 14/11: sem Genius nem Mobile nessa noite, mas as outras noites da reserva mantêm', () => {
        // 13→15 = noites 13 e 14 (R$ 600 cada), no computador, 2 dias de antecedência
        const r = quote({ checkIn: '2026-11-13', checkOut: '2026-11-15', perNight: 600 });
        // noite 13: 20% + 10% + 5% em cascata = 189,60; noite 14: 10% + 5% = 87,00 (sem Genius)
        expect(r?.discountAmount).toBeCloseTo(276.6, 1);
        const geniusItem = r?.items.find((item) => item.id === 'genius');
        expect(geniusItem?.discountAmount).toBe(120); // 20% só da noite de 13
        // reserva só da noite de 14: nada de Genius
        expect(names(quote({ checkIn: '2026-11-14', checkOut: '2026-11-15', perNight: 600 }))).toEqual(['last', 'nr']);
    });

    it('Mobile também fica de fora na noite de 14/11', () => {
        const only14 = quote({ checkIn: '2026-11-14', checkOut: '2026-11-15', perNight: 600, isMobile: true });
        expect(names(only14)).toEqual(['last', 'nr']);
    });

    it('depois de 05/02/2027 a Antecipada e a Última hora saem; ficam Genius + Não reembolsável', () => {
        const r = quote({ checkIn: '2027-02-12', checkOut: '2027-02-14', perNight: 499 });
        expect(names(r)).toEqual(['genius', 'nr']);
        expect(998 - (r?.discountAmount ?? 0)).toBeCloseTo(758.48, 1); // × 0,8 × 0,95
    });

    it('estadia que atravessa o fim da janela (04→07/02/2027): a Antecipada vale só nas noites 4 e 5', () => {
        const r = quote({ checkIn: '2027-02-04', checkOut: '2027-02-07', perNight: 400 });
        const earlyItem = r?.items.find((item) => item.id === 'early');
        // noites 4 e 5: Genius 20% (80) → 320; Antecipada 10% de 320 = 32; Não reembolsável 5% de 288 = 14,40
        expect(earlyItem?.discountAmount).toBeCloseTo(64, 1); // 2 noites × 32
        expect(r?.items.find((item) => item.id === 'genius')?.discountAmount).toBe(240); // 3 noites × 80
    });

    it('antes de 05/11/2026 (janela de venda da Antecipada) ela não vale', () => {
        const r = quote({ checkIn: '2026-12-11', checkOut: '2026-12-13', perNight: 599, bookingDayKey: '2026-11-04' });
        expect(names(r)).toEqual(['genius', 'nr']);
    });

    it('o que o hóspede vê: selo com o percentual real e preço que bate (caso da tela: R$ 449 → R$ 307,12)', () => {
        const r = quote({ checkIn: '2026-11-12', checkOut: '2026-11-13', perNight: 449 });
        const pub = toPublicPromotion(r!);
        expect(449 - pub.discountAmount).toBeCloseTo(307.12, 1);
        expect(pub.badgeLabel).toBe('🔥 Última hora + 🏡 Reserva direta: 31,6% OFF');
        expect(pub.items.map((i) => i.name)).toEqual(['Última hora', 'Desconto reserva direta']);
        expect(JSON.stringify({ name: pub.name, badgeLabel: pub.badgeLabel, items: pub.items })).not.toMatch(/Genius|reembols/i); // nenhum nome interno vaza
    });

    it('no celular o selo junta as duas visíveis e mostra o total', () => {
        const r = quote({ checkIn: '2026-12-11', checkOut: '2026-12-13', perNight: 599, isMobile: true });
        const pub = toPublicPromotion(r!);
        expect(pub.badgeLabel).toBe('🐦 Reserva antecipada + 📱 Tarifa mobile + 🏡 Reserva direta: 38,4% OFF');
    });

    it('só Genius + Não reembolsável (categoria Reserva direta): selo e linha únicos', () => {
        const r = quote({ checkIn: '2026-11-20', checkOut: '2026-11-22', perNight: 699 });
        const pub = toPublicPromotion(r!);
        expect(pub.badgeLabel).toBe('🏡 Reserva direta: 24% OFF');
        expect(pub.items.map((i) => i.name)).toEqual(['Desconto reserva direta']);
    });
});
