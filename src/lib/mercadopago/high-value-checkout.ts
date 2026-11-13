export function requiresHostedMercadoPagoCheckout(totalAmount: unknown) {
    const amount = Number(totalAmount);
    return Number.isFinite(amount) && amount > 0;
}
