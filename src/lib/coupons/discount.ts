export function calculateCouponDiscount(params: {
    couponType: 'PERCENT' | 'FIXED';
    couponValue: number;
    subtotal: number;
    maxDiscountAmount?: number;
}) {
    const { couponType, couponValue, subtotal, maxDiscountAmount } = params;

    let amount = 0;

    if (couponType === 'PERCENT') {
        amount = subtotal * (couponValue / 100);
    } else {
        amount = couponValue;
    }

    if (Number.isFinite(maxDiscountAmount ?? NaN)) {
        amount = Math.min(amount, Number(maxDiscountAmount));
    }

    amount = Math.max(0, Math.min(amount, subtotal));
    const total = Math.max(0, subtotal - amount);

    return {
        amount: Number(amount.toFixed(2)),
        total: Number(total.toFixed(2)),
    };
}