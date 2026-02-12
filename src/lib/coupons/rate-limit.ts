import { hashTelemetryValue, normalizeGuestEmail } from '@/lib/coupons/hash';

type Scope = 'validate' | 'reserve';

type BucketStore = {
    validate: Map<string, number[]>;
    reserve: Map<string, number[]>;
};

const bucketStore: BucketStore = {
    validate: new Map(),
    reserve: new Map(),
};

function parsePositiveInt(raw: string | undefined, fallback: number) {
    const n = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getScopeConfig(scope: Scope) {
    const windowMs = parsePositiveInt(process.env.COUPON_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);

    if (scope === 'reserve') {
        return {
            windowMs,
            maxAttempts: parsePositiveInt(process.env.COUPON_RESERVE_RATE_LIMIT_MAX, 8),
        };
    }

    return {
        windowMs,
        maxAttempts: parsePositiveInt(process.env.COUPON_VALIDATE_RATE_LIMIT_MAX, 15),
    };
}

function extractClientIp(request: Request) {
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const first = forwardedFor.split(',')[0]?.trim();
    const realIp = request.headers.get('x-real-ip') || '';
    return first || realIp || 'unknown';
}

function consumeAttempt(scope: Scope, key: string, now: number, maxAttempts: number, windowMs: number) {
    const scopedBuckets = bucketStore[scope];
    const prev = scopedBuckets.get(key) ?? [];
    const fresh = prev.filter((t) => now - t < windowMs);
    fresh.push(now);
    scopedBuckets.set(key, fresh);
    return fresh.length > maxAttempts;
}

export function shouldThrottleCouponRequest(params: {
    scope: Scope;
    request: Request;
    guestEmail?: string;
}) {
    const { scope, request, guestEmail } = params;
    const { windowMs, maxAttempts } = getScopeConfig(scope);
    const now = Date.now();

    const ipRaw = extractClientIp(request);
    const emailRaw = normalizeGuestEmail(guestEmail);

    const ipHash = hashTelemetryValue(ipRaw);
    const emailHash = emailRaw ? hashTelemetryValue(emailRaw) : 'anon';

    const keyByIp = `ip:${ipHash}`;
    const keyByIdentity = `identity:${ipHash}:${emailHash}`;

    const blockedByIp = consumeAttempt(scope, keyByIp, now, maxAttempts, windowMs);
    const blockedByIdentity = consumeAttempt(scope, keyByIdentity, now, maxAttempts, windowMs);

    return blockedByIp || blockedByIdentity;
}

export function __resetCouponRateLimitForTests() {
    bucketStore.validate.clear();
    bucketStore.reserve.clear();
}
