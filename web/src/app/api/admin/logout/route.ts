import { NextResponse } from 'next/server';
import { getAdminSessionCookieName } from '@/lib/admin-jwt';

export async function POST() {
    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({ ok: true });

    const currentCookieName = getAdminSessionCookieName(process.env.NODE_ENV);
    const legacyCookieName = 'admin_token';
    const devCookieName = 'admin_session';
    const prodCookieName = '__Host-admin_session';

    const expire = (name: string, secure: boolean) => {
        response.cookies.set({
            name,
            value: '',
            httpOnly: true,
            secure,
            sameSite: 'strict',
            path: '/',
            maxAge: 0,
            expires: new Date(0),
        });
    };

    if (isProd) {
        expire(prodCookieName, true);
    } else {
        expire(devCookieName, false);
        expire(prodCookieName, false);
    }

    expire(legacyCookieName, isProd);

    return response;
}
