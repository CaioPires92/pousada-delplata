import { describe, it, expect } from 'vitest';
import { getAdminSessionCookieName, readAdminSessionTokenFromCookies } from './admin-jwt';
import { vi } from 'vitest';

describe('admin-jwt', () => {
  it('getAdminSessionCookieName retorna nome correto por ambiente', () => {
    expect(getAdminSessionCookieName('production')).toBe('__Host-admin_session');
    expect(getAdminSessionCookieName('development')).toBe('admin_session');
    expect(getAdminSessionCookieName(undefined)).toBe('admin_session');
  });

  it('readAdminSessionTokenFromCookies usa fallback no dev/test', () => {
    const cookies = {
      get: (name: string) => {
        if (name === 'admin_session') return { value: 'dev-token' };
        if (name === '__Host-admin_session') return { value: 'prod-token' };
        return undefined as any;
      },
    };
    expect(readAdminSessionTokenFromCookies(cookies as any, 'development')).toBe('dev-token');
    expect(readAdminSessionTokenFromCookies(cookies as any, 'test')).toBe('dev-token');
    expect(readAdminSessionTokenFromCookies(cookies as any, 'production')).toBe('prod-token');
  });

  it('verifyAdminJwt retorna claims válidas (mock crypto)', async () => {
    vi.resetModules();
    vi.mock('jose', () => ({
      jwtVerify: async () => ({
        payload: { email: 'admin@delplata.com.br', role: 'admin', sub: 'admin-1' },
      }),
    }));
    const mod = await import('./admin-jwt');
    const claims = await mod.verifyAdminJwt('x', 'y');
    expect(claims).toEqual({ adminId: 'admin-1', email: 'admin@delplata.com.br', role: 'admin' });
  });

  it('verifyAdminJwt retorna null quando payload inválido', async () => {
    vi.resetModules();
    vi.doMock('jose', () => ({
      jwtVerify: async () => ({ payload: { role: 'user' } }),
    }));
    const mod = await import('./admin-jwt');
    const claims = await mod.verifyAdminJwt('x', 'y');
    expect(claims).toBeNull();
  });
});
