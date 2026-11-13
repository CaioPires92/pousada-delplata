import { describe, expect, it } from 'vitest';

import {
    requiresHostedMercadoPagoCheckout,
} from './high-value-checkout';

describe('hosted Mercado Pago checkout', () => {
    it('routes every reservation with a positive total to hosted checkout', () => {
        expect(requiresHostedMercadoPagoCheckout(0)).toBe(false);
        expect(requiresHostedMercadoPagoCheckout(0.01)).toBe(true);
        expect(requiresHostedMercadoPagoCheckout(2499.99)).toBe(true);
        expect(requiresHostedMercadoPagoCheckout(3796)).toBe(true);
    });
});
