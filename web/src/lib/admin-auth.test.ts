import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminJwtClaims } from './admin-jwt';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      void name;
      return undefined as any;
    },
  }),
}));

describe('requireAdminAuth', () => {
  let requireAdminAuth: typeof import('./admin-auth').requireAdminAuth;

  beforeEach(async () => {
    vi.resetModules();
    delete (process.env as any).ADMIN_JWT_SECRET;
    (process.env as any).NODE_ENV = 'test';
    ({ requireAdminAuth } = await import('./admin-auth'));
  });

  it('retorna 500 quando ADMIN_JWT_SECRET está ausente', async () => {
    const res = await requireAdminAuth();
    const body = await (res as any).json();
    expect((res as any).status).toBe(500);
    expect(body).toEqual({ error: 'missing_env', missing: ['ADMIN_JWT_SECRET'] });
  });

  

  it('retorna claims quando token é válido', async () => {
    (process.env as any).ADMIN_JWT_SECRET = 'secret';
    const mod = await import('next/headers');
    (mod as any).cookies = async () => ({
      get: (name: string) => {
        void name;
        return { value: 'token' };
      },
    });
    vi.resetModules();
    vi.mock('@/lib/admin-jwt', () => ({
      readAdminSessionTokenFromCookies: (cookies: any, env: string | undefined) => {
        void cookies;
        void env;
        return 'token';
      },
      verifyAdminJwt: async (token: string, secret: string): Promise<AdminJwtClaims> => {
        void token;
        void secret;
        return {
          adminId: 'admin-1',
          email: 'admin@delplata.com.br',
          role: 'admin',
        };
      },
    }));
    ({ requireAdminAuth } = await import('./admin-auth'));
    const claims = await requireAdminAuth();
    expect(claims).toEqual({
      adminId: 'admin-1',
      email: 'admin@delplata.com.br',
      role: 'admin',
    });
  });
});
