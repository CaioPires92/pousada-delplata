// @vitest-environment node

import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('security headers', () => {
    it('adds browser hardening headers to every route', async () => {
        const rules = await nextConfig.headers?.();
        const headers = Object.fromEntries(
            (rules?.[0]?.headers || []).map(({ key, value }) => [key, value])
        );

        expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
        expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'self'");
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
        expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    });
});
