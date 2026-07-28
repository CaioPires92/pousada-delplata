import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function getKey() {
    const secret = String(process.env.ADMIN_JWT_SECRET || '');
    if (!secret) throw new Error('ADMIN_JWT_SECRET is required to protect coupon codes');
    return createHash('sha256').update(`coupon-code:${secret}`).digest();
}

export function encryptCouponCode(code: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptCouponCode(payload?: string | null) {
    if (!payload) return null;
    try {
        const [ivValue, tagValue, encryptedValue] = payload.split('.');
        if (!ivValue || !tagValue || !encryptedValue) return null;
        const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivValue, 'base64url'));
        decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
        return Buffer.concat([
            decipher.update(Buffer.from(encryptedValue, 'base64url')),
            decipher.final(),
        ]).toString('utf8');
    } catch {
        return null;
    }
}
