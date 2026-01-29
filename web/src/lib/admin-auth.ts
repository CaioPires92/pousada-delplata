import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function requireAdminAuth() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        const isDev = process.env.NODE_ENV !== 'production';
        return NextResponse.json(
            isDev ? { error: 'missing_env', missing: ['JWT_SECRET'] } : { error: 'Server configuration error' },
            { status: 500 }
        );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        jwt.verify(token, jwtSecret);
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}
