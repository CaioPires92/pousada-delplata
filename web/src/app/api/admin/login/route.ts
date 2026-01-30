import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { opsLog } from '@/lib/ops-log';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getAdminSessionCookieName, signAdminJwt } from '@/lib/admin-jwt';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const memoryFailures = new Map<string, number[]>();

const upstashRatelimit =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new Ratelimit({
            redis: Redis.fromEnv(),
            limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, '15 m'),
        })
        : null;

function getClientIp(request: NextRequest) {
    const header = request.headers.get('x-forwarded-for');
    const ip = header ? header.split(',')[0]?.trim() : undefined;
    return ip || request.headers.get('x-real-ip') || 'unknown';
}

async function consumeFailedLoginSlot(key: string) {
    if (upstashRatelimit) {
        const result = await upstashRatelimit.limit(key);
        return !result.success;
    }

    const now = Date.now();
    const prev = memoryFailures.get(key) ?? [];
    const next = prev.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    next.push(now);
    memoryFailures.set(key, next);
    return next.length > RATE_LIMIT_MAX;
}

export async function POST(request: NextRequest) {
    try {
        // ADMIN_EMAIL / ADMIN_PASSWORD são legacy e não são usados; auth admin depende de ADMIN_JWT_SECRET + AdminUser (Prisma).
        const jwtSecret = process.env.ADMIN_JWT_SECRET;

        const missing = [
            !jwtSecret ? 'ADMIN_JWT_SECRET' : null,
        ].filter(Boolean) as string[];

        if (missing.length > 0) {
            const isDev = process.env.NODE_ENV !== 'production';
            return NextResponse.json(
                isDev ? { error: 'missing_env', missing } : { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const ttlMinutesRaw = process.env.ADMIN_SESSION_TTL_MINUTES;
        const ttlMinutesParsed = ttlMinutesRaw ? Number.parseInt(ttlMinutesRaw, 10) : NaN;
        const ttlMinutes = Number.isFinite(ttlMinutesParsed) && ttlMinutesParsed > 0 ? ttlMinutesParsed : 45;
        const maxAgeSeconds = ttlMinutes * 60;

        const { email, password } = await request.json();
        const ip = getClientIp(request);
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const passwordValue = typeof password === 'string' ? password : '';

        const invalid = async () => {
            opsLog('warn', 'ADMIN_LOGIN_INVALID', { reason: 'INVALID_CREDENTIALS' });

            const blockedByIp = await consumeFailedLoginSlot(`admin_login_fail:ip:${ip}`);
            const blockedByIpEmail = normalizedEmail
                ? await consumeFailedLoginSlot(`admin_login_fail:ip_email:${ip}:${normalizedEmail}`)
                : false;

            if (blockedByIp || blockedByIpEmail) {
                return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
            }

            return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
        };

        if (!normalizedEmail || !passwordValue) return await invalid();

        const user = await prisma.adminUser.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, email: true, passwordHash: true, isActive: true },
        });

        if (!user || !user.isActive) return await invalid();

        const ok = await bcrypt.compare(passwordValue, user.passwordHash);
        if (!ok) return await invalid();

        const token = await signAdminJwt({
            adminId: user.id,
            email: user.email,
            secret: jwtSecret!,
            ttlMinutes,
        });

        const response = NextResponse.json({ ok: true, user: { email: user.email } });
        opsLog('info', 'ADMIN_LOGIN_SUCCESS', { adminId: user.id });

        const isProd = process.env.NODE_ENV === 'production';
        const cookieName = getAdminSessionCookieName(process.env.NODE_ENV);

        response.cookies.set({
            name: cookieName,
            value: token,
            httpOnly: true,
            secure: isProd,
            sameSite: 'strict',
            path: '/',
            maxAge: maxAgeSeconds,
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
