import { createHmac, timingSafeEqual } from 'node:crypto';
import { readAdminSessionTokenFromCookies, verifyAdminJwt } from '@/lib/admin-jwt';

const BOOKING_ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;

function getSigningSecret() {
    return String(process.env.BOOKING_ACCESS_SECRET || process.env.ADMIN_JWT_SECRET || '').trim();
}

function getVerificationSecrets() {
    return [process.env.BOOKING_ACCESS_SECRET, process.env.ADMIN_JWT_SECRET]
        .map((secret) => String(secret || '').trim())
        .filter((secret, index, secrets) => secret && secrets.indexOf(secret) === index);
}

function signPayload(payload: string, secret: string) {
    return createHmac('sha256', secret).update(payload).digest('base64url');
}

function getCookieValue(request: Request, name: string) {
    const cookies = String(request.headers.get('cookie') || '').split(';');
    for (const cookie of cookies) {
        const separator = cookie.indexOf('=');
        if (separator < 0) continue;
        if (cookie.slice(0, separator).trim() !== name) continue;
        return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
    return undefined;
}

export function getBookingAccessCookieName(bookingId: string) {
    return `booking_access_${bookingId}`;
}

export function getBookingAccessCookieOptions(bookingId: string) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: `/api/bookings/${bookingId}`,
        maxAge: BOOKING_ACCESS_TTL_SECONDS,
    };
}

export async function signBookingAccessToken(bookingId: string) {
    const secret = getSigningSecret();
    if (!secret) return null;

    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
        role: 'booking',
        sub: bookingId,
        exp: now + BOOKING_ACCESS_TTL_SECONDS,
    })).toString('base64url');
    return `${payload}.${signPayload(payload, secret)}`;
}

async function verifyBookingAccessToken(token: string, bookingId: string) {
    const secrets = getVerificationSecrets();
    if (secrets.length === 0) return false;

    try {
        const [payload, signature, extra] = token.split('.');
        if (!payload || !signature || extra) return false;

        const provided = Buffer.from(signature);
        const signatureIsValid = secrets.some((secret) => {
            const expected = Buffer.from(signPayload(payload, secret));
            return expected.length === provided.length && timingSafeEqual(expected, provided);
        });
        if (!signatureIsValid) return false;

        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
            role?: unknown;
            sub?: unknown;
            exp?: unknown;
        };
        const now = Math.floor(Date.now() / 1000);
        return claims.role === 'booking'
            && claims.sub === bookingId
            && typeof claims.exp === 'number'
            && claims.exp > now;
    } catch {
        return false;
    }
}

export async function authorizeBookingRequest(request: Request, bookingId: string) {
    const headerToken = String(request.headers.get('x-booking-access-token') || '').trim();
    const cookieToken = getCookieValue(request, getBookingAccessCookieName(bookingId));
    const bookingToken = headerToken || cookieToken;
    if (bookingToken && await verifyBookingAccessToken(bookingToken, bookingId)) {
        return { authorized: true, token: bookingToken };
    }

    const secret = String(process.env.ADMIN_JWT_SECRET || '').trim();
    if (!secret) return { authorized: false, token: null };

    const cookieReader = {
        get(name: string) {
            const value = getCookieValue(request, name);
            return value ? { value } : undefined;
        },
    };
    const adminToken = readAdminSessionTokenFromCookies(cookieReader, process.env.NODE_ENV);
    const admin = adminToken ? await verifyAdminJwt(adminToken, secret) : null;
    return { authorized: Boolean(admin), token: null };
}
