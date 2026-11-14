import { calculateCouponDiscount } from '@/lib/coupons/discount';
import type { ResolvedPromotion } from '@/lib/promotions/engine';

export type CouponProbe = {
    valid: boolean;
    reason?: string;
    couponId?: string;
    stackable?: boolean;
    discountAmount?: number;
    total?: number;
};

export type CouponBlockedReason = 'PROMOTION_EXCLUSIVE' | 'PROMOTION_BETTER_OFFER';

export type StayPricingResult = {
    /** Total antes de qualquer desconto (diárias + extras + pet). */
    fullTotal: number;
    promotion: ResolvedPromotion | null;
    promotionDiscount: number;
    /** Total após a promoção e antes do cupom. */
    subtotalAfterPromotion: number;
    couponApplied: boolean;
    couponDiscount: number;
    /** Resultado do cupom quando ele foi aplicado, ou o motivo da recusa quando não foi. */
    coupon: CouponProbe | null;
    couponBlockedReason?: CouponBlockedReason;
    finalTotal: number;
};

function roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Promoção aceita acumular com este cupom? (lista null = qualquer cupom que também permita acúmulo) */
function promotionAcceptsCoupon(promotion: ResolvedPromotion, couponId: string | undefined) {
    if (!promotion.stackWithCoupons) return false;
    if (promotion.allowedCouponIds === null) return true;
    return Boolean(couponId) && promotion.allowedCouponIds.includes(couponId as string);
}

export function probeCouponFromRecord(coupon: {
    id?: string | null;
    type: string;
    value: unknown;
    maxDiscountAmount?: unknown;
    minBookingValue?: unknown;
    stackable?: boolean | null;
}): (subtotal: number) => CouponProbe {
    const type = String(coupon.type || '').toUpperCase();
    return (subtotal) => {
        if (type !== 'PERCENT' && type !== 'FIXED') return { valid: false, reason: 'INVALID_COUPON_CONFIG' };
        const min = coupon.minBookingValue === null || coupon.minBookingValue === undefined ? null : Number(coupon.minBookingValue);
        if (min !== null && Number.isFinite(min) && subtotal < min) {
            return { valid: false, reason: 'MIN_BOOKING_NOT_REACHED' };
        }
        const max = coupon.maxDiscountAmount === null || coupon.maxDiscountAmount === undefined ? undefined : Number(coupon.maxDiscountAmount);
        const discount = calculateCouponDiscount({
            couponType: type,
            couponValue: Number(coupon.value),
            subtotal,
            maxDiscountAmount: max,
        });
        return {
            valid: true,
            reason: 'OK',
            couponId: coupon.id ? String(coupon.id) : undefined,
            stackable: Boolean(coupon.stackable),
            discountAmount: discount.amount,
            total: discount.total,
        };
    };
}

/**
 * Regra única de compatibilidade promoção × cupom, usada pela busca (preview) e pela criação da reserva.
 *
 * - Sem promoção: só o cupom.
 * - Promoção `exclusive`: cupom barrado.
 * - Promoção `stackWithCoupons` (e o cupom está na lista permitida, se houver) + cupom `stackable`:
 *   o cupom incide sobre o saldo já com a promoção.
 * - Caso contrário: não acumula; fica o que der o MENOR preço final (empate favorece a promoção).
 */
export async function resolveStayPricing(input: {
    fullTotal: number;
    promotion: ResolvedPromotion | null;
    evaluateCoupon: ((subtotal: number) => CouponProbe | Promise<CouponProbe>) | null;
}): Promise<StayPricingResult> {
    const fullTotal = roundMoney(input.fullTotal);
    const evaluate = input.evaluateCoupon;
    const promotion = input.promotion;

    const finish = (parts: {
        promotion: ResolvedPromotion | null;
        coupon: CouponProbe | null;
        couponApplied: boolean;
        couponBlockedReason?: CouponBlockedReason;
    }): StayPricingResult => {
        const promotionDiscount = parts.promotion ? Math.min(parts.promotion.discountAmount, fullTotal) : 0;
        const subtotalAfterPromotion = roundMoney(fullTotal - promotionDiscount);
        const couponDiscount = parts.couponApplied ? Math.min(Number(parts.coupon?.discountAmount || 0), subtotalAfterPromotion) : 0;
        return {
            fullTotal,
            promotion: parts.promotion,
            promotionDiscount: roundMoney(promotionDiscount),
            subtotalAfterPromotion,
            couponApplied: parts.couponApplied,
            couponDiscount: roundMoney(couponDiscount),
            coupon: parts.coupon,
            couponBlockedReason: parts.couponBlockedReason,
            finalTotal: roundMoney(Math.max(0, subtotalAfterPromotion - couponDiscount)),
        };
    };

    if (!promotion) {
        const coupon = evaluate ? await evaluate(fullTotal) : null;
        return finish({ promotion: null, coupon, couponApplied: Boolean(coupon?.valid) });
    }

    if (!evaluate) {
        return finish({ promotion, coupon: null, couponApplied: false });
    }

    const afterPromotion = roundMoney(fullTotal - Math.min(promotion.discountAmount, fullTotal));

    if (promotion.exclusive) {
        const probe = await evaluate(afterPromotion);
        return finish({
            promotion,
            coupon: probe,
            couponApplied: false,
            couponBlockedReason: probe.valid ? 'PROMOTION_EXCLUSIVE' : undefined,
        });
    }

    const stacked = await evaluate(afterPromotion);
    if (stacked.valid && stacked.stackable && promotionAcceptsCoupon(promotion, stacked.couponId)) {
        return finish({ promotion, coupon: stacked, couponApplied: true });
    }

    // Não acumula: compara "só promoção" com "só cupom" e fica com o melhor preço para o hóspede.
    const couponOnly = await evaluate(fullTotal);
    if (couponOnly.valid && Number(couponOnly.total) < afterPromotion) {
        return finish({ promotion: null, coupon: couponOnly, couponApplied: true });
    }

    return finish({
        promotion,
        coupon: couponOnly.valid ? couponOnly : stacked,
        couponApplied: false,
        couponBlockedReason: couponOnly.valid ? 'PROMOTION_BETTER_OFFER' : undefined,
    });
}
