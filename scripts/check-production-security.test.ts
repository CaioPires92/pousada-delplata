import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { findProductionSecurityErrors } = require('./check-production-security.js');

describe('production security check', () => {
    const secrets = {
        MP_ACCESS_TOKEN: 'prod', MP_WEBHOOK_SECRET: 'secret', ADMIN_JWT_SECRET: 'secret', BOOKING_ACCESS_SECRET: 'secret',
        ASAAS_API_KEY: '$aact_prod', ASAAS_WEBHOOK_TOKEN: 'x'.repeat(40), ASAAS_ENVIRONMENT: 'production',
    };

    it('blocks test payments in production', () => {
        expect(findProductionSecurityErrors({ VERCEL_ENV: 'production', ENABLE_TEST_PAYMENTS: 'true', ...secrets }))
            .toContain('ENABLE_TEST_PAYMENTS deve estar explicitamente definido como false em produção.');
    });

    it('accepts an explicitly safe production environment', () => {
        expect(findProductionSecurityErrors({ VERCEL_ENV: 'production', ENABLE_TEST_PAYMENTS: 'false', ...secrets })).toEqual([]);
    });

    it('blocks a production deploy without the Asaas configuration', () => {
        const errors = findProductionSecurityErrors({
            VERCEL_ENV: 'production', ENABLE_TEST_PAYMENTS: 'false', ...secrets,
            ASAAS_API_KEY: '', ASAAS_WEBHOOK_TOKEN: '', ASAAS_ENVIRONMENT: 'sandbox',
        });
        expect(errors).toContain('ASAAS_API_KEY é obrigatório em produção.');
        expect(errors).toContain('ASAAS_WEBHOOK_TOKEN é obrigatório em produção.');
        expect(errors).toContain('ASAAS_ENVIRONMENT deve ser "production" em produção (senão os pagamentos vão para o sandbox).');
    });

    it('rejects a short Asaas webhook token', () => {
        expect(findProductionSecurityErrors({
            VERCEL_ENV: 'production', ENABLE_TEST_PAYMENTS: 'false', ...secrets, ASAAS_WEBHOOK_TOKEN: 'curto',
        })).toContain('ASAAS_WEBHOOK_TOKEN deve ter pelo menos 32 caracteres.');
    });

    it('ignores preview deployments', () => {
        expect(findProductionSecurityErrors({ VERCEL_ENV: 'preview' })).toEqual([]);
    });
});
