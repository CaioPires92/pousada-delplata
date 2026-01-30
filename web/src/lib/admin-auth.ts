import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readAdminSessionTokenFromCookies, type AdminJwtClaims, verifyAdminJwt } from '@/lib/admin-jwt';

export async function requireAdminAuth(): Promise<AdminJwtClaims | NextResponse> {
    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
        const isDev = process.env.NODE_ENV !== 'production';
        return NextResponse.json(
            isDev ? { error: 'missing_env', missing: ['ADMIN_JWT_SECRET'] } : { error: 'Server configuration error' },
            { status: 500 }
        );
    }

    const cookieStore = await cookies();
    const token = readAdminSessionTokenFromCookies(cookieStore, process.env.NODE_ENV);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const claims = await verifyAdminJwt(token, jwtSecret);
    if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return claims;
}
