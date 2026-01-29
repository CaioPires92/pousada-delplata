import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';

describe('Admin Login API', () => {
    beforeEach(() => {
        delete process.env.JWT_SECRET;
        delete process.env.ADMIN_EMAIL;
        delete process.env.ADMIN_PASSWORD;
        process.env.NODE_ENV = 'test';
    });

    it('should return 500 with missing_env details when envs are missing (dev/test)', async () => {
        process.env.JWT_SECRET = 'secret';
        const req = new Request('http://localhost/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({
            error: 'missing_env',
            missing: expect.arrayContaining(['ADMIN_EMAIL', 'ADMIN_PASSWORD']),
        });
    });

    it('should return 401 for invalid credentials', async () => {
        process.env.JWT_SECRET = 'secret';
        process.env.ADMIN_EMAIL = 'admin@delplata.com.br';
        process.env.ADMIN_PASSWORD = 'correct';

        const req = new Request('http://localhost/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@delplata.com.br', password: 'wrong' }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(401);
        await expect(res.json()).resolves.toEqual({ error: 'invalid_credentials' });
    });

    it('should return 200 and set admin_token cookie for valid credentials', async () => {
        process.env.JWT_SECRET = 'secret';
        process.env.ADMIN_EMAIL = 'admin@delplata.com.br';
        process.env.ADMIN_PASSWORD = 'correct';

        const req = new Request('http://localhost/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@delplata.com.br', password: 'correct' }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(typeof data.token).toBe('string');
        expect(data.email).toBe('admin@delplata.com.br');
        expect(res.headers.get('set-cookie')).toContain('admin_token=');
    });
});

