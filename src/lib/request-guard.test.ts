import { describe, expect, it } from 'vitest';
import { consumeRequestLimit, isHoneypotFilled, readJsonBody } from './request-guard';

describe('request guard', () => {
    it('parses JSON within the limit and rejects oversized bodies', async () => {
        await expect(readJsonBody(new Request('https://example.test', {
            method: 'POST', body: JSON.stringify({ ok: true }),
        }), 100)).resolves.toEqual({ ok: true });
        await expect(readJsonBody(new Request('https://example.test', {
            method: 'POST', body: JSON.stringify({ text: 'x'.repeat(100) }),
        }), 20)).rejects.toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
    });

    it('detects honeypots and repeated identities', () => {
        expect(isHoneypotFilled({ website: 'spam.test' })).toBe(true);
        const request = new Request('https://example.test', { headers: { 'x-forwarded-for': '203.0.113.10' } });
        expect(consumeRequestLimit({ request, scope: 'test-unique', limit: 1, windowMs: 60_000 }).allowed).toBe(true);
        expect(consumeRequestLimit({ request, scope: 'test-unique', limit: 1, windowMs: 60_000 }).allowed).toBe(false);
    });
});
