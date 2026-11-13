import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runPendingBookingMaintenance } from '@/lib/expire-stale-bookings';
import { GET } from './route';

vi.mock('@/lib/expire-stale-bookings', () => ({
    runPendingBookingMaintenance: vi.fn(),
}));
vi.mock('@/lib/ops-log', () => ({ opsLog: vi.fn() }));

function cronRequest(authorization?: string) {
    return new Request('https://example.test/api/cron/cleanup-bookings', {
        headers: authorization ? { authorization } : {},
    });
}

describe('GET /api/cron/cleanup-bookings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(runPendingBookingMaintenance).mockResolvedValue({
            expiration: { expiredCount: 1 },
        } as any);
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('runs the maintenance with the right secret', async () => {
        vi.stubEnv('CRON_SECRET', 'secret-123');

        const response = await GET(cronRequest('Bearer secret-123'));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ ok: true, expiration: { expiredCount: 1 } });
        expect(runPendingBookingMaintenance).toHaveBeenCalledWith({ source: 'cron', sendAdminAlerts: true });
    });

    it('rejects a missing or wrong secret', async () => {
        vi.stubEnv('CRON_SECRET', 'secret-123');

        expect((await GET(cronRequest())).status).toBe(401);
        expect((await GET(cronRequest('Bearer other'))).status).toBe(401);
        expect(runPendingBookingMaintenance).not.toHaveBeenCalled();
    });

    it('refuses to run in production without a configured secret', async () => {
        vi.stubEnv('CRON_SECRET', '');
        vi.stubEnv('NODE_ENV', 'production');

        const response = await GET(cronRequest());

        expect(response.status).toBe(500);
        expect(runPendingBookingMaintenance).not.toHaveBeenCalled();
    });
});
