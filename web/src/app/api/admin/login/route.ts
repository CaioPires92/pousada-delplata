import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import * as Sentry from '@sentry/nextjs';
import { opsLog } from '@/lib/ops-log';

export async function POST(request: NextRequest) {
    try {
        const jwtSecret = process.env.JWT_SECRET;
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        const missing = [
            !jwtSecret ? 'JWT_SECRET' : null,
            !adminEmail ? 'ADMIN_EMAIL' : null,
            !adminPassword ? 'ADMIN_PASSWORD' : null,
        ].filter(Boolean) as string[];

        if (missing.length > 0) {
            const isDev = process.env.NODE_ENV !== 'production';
            return NextResponse.json(
                isDev ? { error: 'missing_env', missing } : { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const jwtSecretValue = jwtSecret!;
        const adminEmailValue = adminEmail!;
        const adminPasswordValue = adminPassword!;

        const { email, password } = await request.json();

        if (email !== adminEmailValue || password !== adminPasswordValue) {
            opsLog('warn', 'ADMIN_LOGIN_INVALID', { reason: 'INVALID_PASSWORD' });
            return NextResponse.json(
                { error: 'invalid_credentials' },
                { status: 401 }
            );
        }

        // Gerar token JWT
        const token = jwt.sign(
            {
                id: 'env-admin',
                email: adminEmailValue,
                name: 'Administrador',
            },
            jwtSecretValue,
            { expiresIn: '7d' }
        );

        // Create response
        const response = NextResponse.json({
            token,
            name: 'Administrador',
            email: adminEmailValue,
        });
        opsLog('info', 'ADMIN_LOGIN_SUCCESS', { adminId: 'env-admin' });

        // Set secure cookie
        response.cookies.set({
            name: 'admin_token',
            value: token,
            httpOnly: true, // Not accessible via JS
            secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;

    } catch (error) {
        Sentry.captureException(error);
        opsLog('error', 'ADMIN_LOGIN_ERROR');
        return NextResponse.json(
            { error: 'Erro ao fazer login' },
            { status: 500 }
        );
    }
}
