export function normalizeAdminActionReason(value: unknown) {
    const reason = String(value || '').trim();
    return reason.replace(/\s+/g, ' ');
}

export async function readAdminActionReason(request: Request) {
    try {
        const contentType = String(request.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('application/json')) return '';
        const body = await request.json().catch(() => ({}));
        return normalizeAdminActionReason((body as { reason?: unknown })?.reason);
    } catch {
        return '';
    }
}
