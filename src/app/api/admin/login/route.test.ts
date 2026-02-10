import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
    default: {
        adminUser: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('bcryptjs', () => ({
    default: {
        compare: vi.fn(),
    },
    compare: vi.fn(),
}));

vi.mock('@/lib/admin-jwt', () => ({
    getAdminSessionCookieName: vi.fn(() => 'admin_session'),
    signAdminJwt: vi.fn(async () => 'header.payload.signature'),
}));

describe('Admin Login API', () => {
    let POST: typeof import('./route').POST;
    let prisma: typeof import('@/lib/prisma').default;

    beforeEach(async () => {
        delete process.env.ADMIN_JWT_SECRET;
        delete process.env.ADMIN_SESSION_TTL_MINUTES;
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
        (process.env as any).NODE_ENV = 'test';
        vi.clearAllMocks();
    });

    it('should return 500 with missing_env details when envs are missing (dev/test)', async () => {
        vi.resetModules();
        ({ POST } = await import('./route'));

        const req = new Request('http://localhost/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({
            error: 'missing_env',
            missing: expect.arrayContaining(['ADMIN_JWT_SECRET']),
        });
    }, 15000);

    it('should return 401 for invalid credentials', async () => {
        vi.resetModules();
        ({ POST } = await import('./route'));
        prisma = (await import('@/lib/prisma')).default;

        process.env.ADMIN_JWT_SECRET = 'secret';
        (prisma.adminUser.findUnique as any).mockResolvedValue(null);

        const req = new Request('http://localhost/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@delplata.com.br', password: 'wrong' }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(401);
        await expect(res.json()).resolves.toEqual({ error: 'invalid_credentials' });
    });

    it('should return 200 and set admin_session cookie for valid credentials', async () => {
        vi.resetModules();
        ({ POST } = await import('./route'));
        prisma = (await import('@/lib/prisma')).default;

        process.env.ADMIN_JWT_SECRET = 'secret';
        (prisma.adminUser.findUnique as any).mockResolvedValue({
            id: 'admin-1',
            email: 'admin@delplata.com.br',
            passwordHash: '$2a$10$invalid',
            isActive: true,
        });
        const bcryptMod = await import('bcryptjs');
        const compareFn = ((bcryptMod as any).default?.compare ?? (bcryptMod as any).compare) as any;
        compareFn.mockResolvedValue(true);

        const req = new Request('http://localhost/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@delplata.com.br', password: 'correct' }),
        });

        const res = await POST(req as any);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({ ok: true, user: { email: 'admin@delplata.com.br' } });
        expect((data as any).token).toBeUndefined();
        expect(res.headers.get('set-cookie')).toContain('admin_session=');
    });
});
