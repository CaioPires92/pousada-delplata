export const PIX_DISCOUNT_RATE = 0.05;

export function isPixDiscountEnabled() {
    return false;
}

export function applyPixDiscount(amount: number) {
    return Number((amount * (1 - PIX_DISCOUNT_RATE)).toFixed(2));
}
