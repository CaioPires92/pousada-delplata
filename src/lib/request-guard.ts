import crypto from 'crypto';

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

export class RequestGuardError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string) {
        super(message);
    }
}

export async function readJsonBody<T = Record<string, unknown>>(request: Request, maxBytes: number): Promise<T> {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new RequestGuardError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição excede o limite permitido.');
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
        throw new RequestGuardError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição excede o limite permitido.');
    }
    try {
        return JSON.parse(raw) as T;
    } catch {
        throw new RequestGuardError(400, 'INVALID_JSON', 'JSON inválido.');
    }
}

export function getClientIp(request: Request) {
    return (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]
        || request.headers.get('x-forwarded-for')?.split(',')[0]
        || request.headers.get('x-real-ip')
        || 'unknown').trim();
}

export function consumeRequestLimit(params: {
    request: Request;
    scope: string;
    discriminator?: string;
    limit: number;
    windowMs: number;
}) {
    const now = Date.now();
    if (rateBuckets.size > 2_000) {
        for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
    const identity = `${getClientIp(params.request)}:${params.discriminator || ''}`;
    const digest = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24);
    const key = `${params.scope}:${digest}`;
    const current = rateBuckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + params.windowMs } : current;
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    return {
        allowed: bucket.count <= params.limit,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
}

export function isHoneypotFilled(body: unknown) {
    return Boolean(body && typeof body === 'object' && String((body as Record<string, unknown>).website || '').trim());
}
