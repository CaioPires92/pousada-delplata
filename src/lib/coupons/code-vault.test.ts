import { beforeEach, describe, expect, it } from 'vitest';
import { decryptCouponCode, encryptCouponCode } from './code-vault';

describe('coupon code vault', () => {
    beforeEach(() => {
        process.env.ADMIN_JWT_SECRET = 'test-secret-at-least-32-characters-long';
    });

    it('protege e recupera o código completo', () => {
        const encrypted = encryptCouponCode('VOLTA10');

        expect(encrypted).not.toContain('VOLTA10');
        expect(decryptCouponCode(encrypted)).toBe('VOLTA10');
    });

    it('não revela conteúdo inválido', () => {
        expect(decryptCouponCode('invalid')).toBeNull();
    });
});
