import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';

describe('Admin Logout API', () => {
    beforeEach(() => {
        (process.env as any).NODE_ENV = 'test';
    });

    it('should expire admin_session cookie', async () => {
        const res = await POST();
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });

        const setCookie = res.headers.get('set-cookie') || '';
        expect(setCookie).toContain('admin_session=');
        expect(setCookie.toLowerCase()).toContain('max-age=0');
    });
});
