import { describe, expect, it } from 'vitest';
import type { ResolvedPromotion } from '@/lib/promotions/engine';
import { probeCouponFromRecord, resolveStayPricing } from '@/lib/promotions/stacking';

function promo(overrides: Partial<ResolvedPromotion> = {}): ResolvedPromotion {
    return {
        id: 'p1',
        name: 'Última Hora',
        type: 'LAST_MINUTE',
        badgeLabel: '🔥 Oferta de Última Hora: 10% OFF',
        discountPercent: 10,
        discountAmount: 100,
        stackWithCoupons: false,
        allowedCouponIds: null,
        exclusive: false,
        items: [],
        ...overrides,
    };
}

const percentCoupon = (percent: number, stackable = false, id = 'c1') =>
    probeCouponFromRecord({ id, type: 'PERCENT', value: percent, stackable });

describe('resolveStayPricing — lista de cupons permitidos', () => {
    it('acumula só com os cupons da lista', async () => {
        const allowed = await resolveStayPricing({
            fullTotal: 1000,
            promotion: promo({ stackWithCoupons: true, allowedCouponIds: ['c1'] }),
            evaluateCoupon: percentCoupon(10, true, 'c1'),
        });
        expect(allowed.couponApplied).toBe(true);
        expect(allowed.finalTotal).toBe(810);

        const notAllowed = await resolveStayPricing({
            fullTotal: 1000,
            promotion: promo({ stackWithCoupons: true, allowedCouponIds: ['c1'] }),
            evaluateCoupon: percentCoupon(5, true, 'c2'),
        });
        // cupom fora da lista não acumula: fica a promoção (900 < 950)
        expect(notAllowed.couponApplied).toBe(false);
        expect(notAllowed.finalTotal).toBe(900);
        expect(notAllowed.couponBlockedReason).toBe('PROMOTION_BETTER_OFFER');
    });

    it('lista null = qualquer cupom que permita acúmulo; o cupom também precisa permitir', async () => {
        const r = await resolveStayPricing({
            fullTotal: 1000,
            promotion: promo({ stackWithCoupons: true, allowedCouponIds: null }),
            evaluateCoupon: percentCoupon(10, false, 'qualquer'),
        });
        expect(r.finalTotal).toBe(900); // cupom não acumulável → compara, promoção ganha em empate
        expect(r.couponApplied).toBe(false);
    });
});

describe('resolveStayPricing', () => {
    it('sem promoção e sem cupom: preço cheio', async () => {
        const r = await resolveStayPricing({ fullTotal: 1000, promotion: null, evaluateCoupon: null });
        expect(r.finalTotal).toBe(1000);
        expect(r.promotionDiscount).toBe(0);
    });

    it('só cupom (sem promoção) aplica normalmente', async () => {
        const r = await resolveStayPricing({ fullTotal: 1000, promotion: null, evaluateCoupon: percentCoupon(10) });
        expect(r.couponApplied).toBe(true);
        expect(r.finalTotal).toBe(900);
    });

    it('só promoção (sem cupom)', async () => {
        const r = await resolveStayPricing({ fullTotal: 1000, promotion: promo(), evaluateCoupon: null });
        expect(r.finalTotal).toBe(900);
        expect(r.subtotalAfterPromotion).toBe(900);
    });

    it('acumula quando promoção E cupom permitem: cupom incide sobre o saldo já com a promoção', async () => {
        const r = await resolveStayPricing({
            fullTotal: 1000,
            promotion: promo({ stackWithCoupons: true }),
            evaluateCoupon: percentCoupon(10, true),
        });
        expect(r.couponApplied).toBe(true);
        expect(r.promotionDiscount).toBe(100);
        expect(r.couponDiscount).toBe(90); // 10% de 900
        expect(r.finalTotal).toBe(810);
    });

    it('promoção permite mas cupom não: não acumula, fica a melhor (promoção 10% vs cupom 5%)', async () => {
        const r = await resolveStayPricing({
            fullTotal: 1000,
            promotion: promo({ stackWithCoupons: true }),
            evaluateCoupon: percentCoupon(5, false),
        });
        expect(r.couponApplied).toBe(false);
        expect(r.couponBlockedReason).toBe('PROMOTION_BETTER_OFFER');
        expect(r.finalTotal).toBe(900);
    });

    it('não acumula e o cupom é melhor: promoção sai e o cupom vale', async () => {
        const r = await resolveStayPricing({
            fullTotal: 1000,
            promotion: promo(),
            evaluateCoupon: percentCoupon(20, false),
        });
        expect(r.couponApplied).toBe(true);
        expect(r.promotion).toBeNull();
        expect(r.promotionDiscount).toBe(0);
        expect(r.finalTotal).toBe(800);
    });

    it('empate favorece a promoção', async () => {
        const r = await resolveStayPricing({ fullTotal: 1000, promotion: promo(), evaluateCoupon: percentCoupon(10) });
        expect(r.couponApplied).toBe(false);
        expect(r.promotion?.id).toBe('p1');
        expect(r.finalTotal).toBe(900);
    });

    it('exclusive barra qualquer cupom, mesmo que melhor e acumulável', async () => {
        const r = await resolveStayPricing({
            fullTotal: 1000,
            promotion: promo({ exclusive: true }),
            evaluateCoupon: percentCoupon(50, true),
        });
        expect(r.couponApplied).toBe(false);
        expect(r.couponBlockedReason).toBe('PROMOTION_EXCLUSIVE');
        expect(r.finalTotal).toBe(900);
    });

    it('cupom inválido não bloqueia a promoção e não gera motivo de bloqueio', async () => {
        const r = await resolveStayPricing({
            fullTotal: 1000,
            promotion: promo(),
            evaluateCoupon: () => ({ valid: false, reason: 'EXPIRED' }),
        });
        expect(r.couponApplied).toBe(false);
        expect(r.couponBlockedReason).toBeUndefined();
        expect(r.finalTotal).toBe(900);
    });
});

describe('probeCouponFromRecord', () => {
    it('respeita valor mínimo, teto e tipo FIXED', () => {
        const probe = probeCouponFromRecord({ type: 'FIXED', value: 300, minBookingValue: 500, maxDiscountAmount: 200 });
        expect(probe(400)).toMatchObject({ valid: false, reason: 'MIN_BOOKING_NOT_REACHED' });
        expect(probe(1000)).toMatchObject({ valid: true, discountAmount: 200, total: 800 });
    });
});
