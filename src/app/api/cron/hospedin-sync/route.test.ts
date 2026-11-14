import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({ sync: vi.fn() }));

vi.mock('@/lib/hospedin-sync', () => ({
    syncHospedinAvailability: mocks.sync,
    getDefaultHospedinPeriod: () => ({ beginDate: '2026-11-11', endDate: '2027-01-10' }),
}));
vi.mock('@/lib/ops-log', () => ({ opsLog: vi.fn() }));

const req = (token?: string, qs = '') =>
    new Request(`https://x.test/api/cron/hospedin-sync${qs}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

describe('GET /api/cron/hospedin-sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'segredo-de-teste';
        process.env.HOSPEDIN_SYNC_ENABLED = 'true';
    });

    it('sem o segredo configurado, recusa (503); com token errado ou ausente, 401', async () => {
        delete process.env.CRON_SECRET;
        expect((await GET(req('x'))).status).toBe(503);
        process.env.CRON_SECRET = 'segredo-de-teste';
        expect((await GET(req())).status).toBe(401);
        expect((await GET(req('errado'))).status).toBe(401);
        expect(mocks.sync).not.toHaveBeenCalled();
    });

    it('com o segredo certo sincroniza o período padrão e devolve o resultado', async () => {
        mocks.sync.mockResolvedValue({ results: [{ roomTypeId: 'r1', ok: true }] });
        const res = await GET(req('segredo-de-teste'));
        expect(res.status).toBe(200);
        expect(mocks.sync).toHaveBeenCalledWith({ beginDate: '2026-11-11', endDate: '2027-01-10' });
        expect((await res.json()).results).toHaveLength(1);
    });

    it('?days limita ao intervalo permitido e usa o período pedido', async () => {
        mocks.sync.mockResolvedValue({ results: [] });
        await GET(req('segredo-de-teste', '?days=30'));
        const arg = mocks.sync.mock.calls[0][0];
        expect(arg.beginDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        await GET(req('segredo-de-teste', '?days=9999'));
        expect(mocks.sync.mock.calls[1][0]).toEqual({ beginDate: '2026-11-11', endDate: '2027-01-10' }); // fora do limite → padrão
    });

    it('se alguma acomodação falhar, responde 502 (a falha não passa como sucesso)', async () => {
        mocks.sync.mockResolvedValue({
            results: [
                { roomName: 'Triplo', daysSynced: 61, daysChanged: 0, manualOverrides: [] },
                { roomName: 'Duplo', error: 'Hospedin API Error: Forbidden for placeType 284992' },
            ],
        });
        const res = await GET(req('segredo-de-teste'));
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.results).toHaveLength(2);
    });

    it('aceita períodos longos (até 730 dias) para cobrir todo o calendário', async () => {
        mocks.sync.mockResolvedValue({ results: [] });
        await GET(req('segredo-de-teste', '?days=420'));
        const arg = mocks.sync.mock.calls[0][0];
        expect(arg.endDate > arg.beginDate).toBe(true);
        expect(arg.endDate).not.toBe('2027-01-10'); // não caiu no período padrão de 60 dias
    });

    it('com a sincronização desligada responde 503 e erro do Hospedin vira 502', async () => {
        process.env.HOSPEDIN_SYNC_ENABLED = 'false';
        expect((await GET(req('segredo-de-teste'))).status).toBe(503);
        process.env.HOSPEDIN_SYNC_ENABLED = 'true';
        mocks.sync.mockRejectedValue(new Error('Hospedin API Error: Forbidden'));
        const res = await GET(req('segredo-de-teste'));
        expect(res.status).toBe(502);
        expect((await res.json()).message).toContain('Forbidden');
    });
});
