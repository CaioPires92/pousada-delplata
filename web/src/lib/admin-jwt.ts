import { jwtVerify, SignJWT } from 'jose';

export type AdminJwtClaims = {
    adminId: string;
    email: string;
    role: 'admin';
};

export function getAdminSessionCookieName(nodeEnv: string | undefined) {
    return nodeEnv === 'production' ? '__Host-admin_session' : 'admin_session';
}

export function readAdminSessionTokenFromCookies(
    cookies: { get(name: string): { value: string } | undefined },
    nodeEnv: string | undefined
) {
    const prodName = '__Host-admin_session';
    const devName = 'admin_session';

    if (nodeEnv === 'production') return cookies.get(prodName)?.value;
    return cookies.get(devName)?.value ?? cookies.get(prodName)?.value;
}

function getKey(secret: string) {
    return new TextEncoder().encode(secret);
}

function getJti() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export async function signAdminJwt(params: {
    adminId: string;
    email: string;
    secret: string;
    ttlMinutes: number;
}) {
    const ttlMinutes = Number.isFinite(params.ttlMinutes) && params.ttlMinutes > 0 ? params.ttlMinutes : 45;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = nowSeconds + ttlMinutes * 60;

    return new SignJWT({ email: params.email, role: 'admin' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(params.adminId)
        .setJti(getJti())
        .setIssuedAt(nowSeconds)
        .setExpirationTime(expSeconds)
        .sign(getKey(params.secret));
}

export async function verifyAdminJwt(token: string, secret: string): Promise<AdminJwtClaims | null> {
    try {
        const { payload } = await jwtVerify(token, getKey(secret), { algorithms: ['HS256'] });

        const role = payload.role;
        const email = payload.email;
        const sub = payload.sub;

        if (role !== 'admin') return null;
        if (typeof email !== 'string' || email.length === 0) return null;
        if (typeof sub !== 'string' || sub.length === 0) return null;

        return { adminId: sub, email, role: 'admin' };
    } catch {
        return null;
    }
}
