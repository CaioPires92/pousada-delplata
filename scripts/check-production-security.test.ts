import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { findProductionSecurityErrors } = require('./check-production-security.js');

describe('production security check', () => {
    const secrets = {
        MP_ACCESS_TOKEN: 'prod', MP_WEBHOOK_SECRET: 'secret', ADMIN_JWT_SECRET: 'secret', BOOKING_ACCESS_SECRET: 'secret',
    };

    it('blocks test payments in production', () => {
        expect(findProductionSecurityErrors({ VERCEL_ENV: 'production', ENABLE_TEST_PAYMENTS: 'true', ...secrets }))
            .toContain('ENABLE_TEST_PAYMENTS deve estar explicitamente definido como false em produção.');
    });

    it('accepts an explicitly safe production environment', () => {
        expect(findProductionSecurityErrors({ VERCEL_ENV: 'production', ENABLE_TEST_PAYMENTS: 'false', ...secrets })).toEqual([]);
    });
});
