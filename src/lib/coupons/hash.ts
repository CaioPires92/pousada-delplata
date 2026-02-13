import { createHash } from 'crypto';

export function normalizeCouponCode(code: string) {
    return String(code || '')
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase();
}

export function normalizeGuestEmail(email?: string | null) {
    return email ? email.trim().toLowerCase() : '';
}

export function normalizeGuestPhone(phone?: string | null) {
    return phone ? phone.replace(/\D+/g, '') : '';
}

export function getCouponCodePrefix(code: string, len = 6) {
    const normalized = normalizeCouponCode(code);
    return normalized.slice(0, len);
}

export function hashCouponCode(code: string) {
    const normalized = normalizeCouponCode(code);
    const pepper = process.env.COUPON_CODE_PEPPER || '';
    return createHash('sha256')
        .update(`${normalized}|${pepper}`)
        .digest('hex');
}

export function hashTelemetryValue(value: string) {
    return createHash('sha256').update(String(value)).digest('hex');
}