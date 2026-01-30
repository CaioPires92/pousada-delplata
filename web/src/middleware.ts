import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readAdminSessionTokenFromCookies, verifyAdminJwt } from '@/lib/admin-jwt';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    const isAdminPage = path.startsWith('/admin');
    const isAdminApi = path.startsWith('/api/admin');

    if (!isAdminPage && !isAdminApi) return NextResponse.next();

    if (path === '/admin/login' || path === '/api/admin/login' || path === '/api/admin/logout') {
        return NextResponse.next();
    }

    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
        const isDev = process.env.NODE_ENV !== 'production';
        const payload = isDev ? { error: 'missing_env', missing: ['ADMIN_JWT_SECRET'] } : { error: 'Server configuration error' };
        return NextResponse.json(payload, { status: 500 });
    }

    const token = readAdminSessionTokenFromCookies(request.cookies, process.env.NODE_ENV);
    const unauthorized = () => {
        if (isAdminApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.redirect(new URL('/admin/login', request.url));
    };

    if (!token) return unauthorized();

    const claims = await verifyAdminJwt(token, jwtSecret);
    if (!claims) return unauthorized();

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/api/admin/:path*'
    ],
};
