import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const call = (cep: string) =>
    GET(new Request(`https://x.test/api/cep/${cep}`, { headers: { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } }), {
        params: Promise.resolve({ cep }),
    });

describe('GET /api/cep/[cep]', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('recusa CEP com formato inválido sem consultar nada', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const res = await call('123');
        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('devolve rua, bairro e cidade do ViaCEP', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ logradouro: 'Rua das Flores', bairro: 'Centro', localidade: 'Serra Negra', uf: 'SP' }) })));
        const res = await call('13720-000');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ postalCode: '13720000', address: 'Rua das Flores', province: 'Centro', city: 'Serra Negra', state: 'SP' });
    });

    it('CEP inexistente vira 404 e falha do serviço vira 502', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ erro: true }) })));
        expect((await call('00000000')).status).toBe(404);

        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout'); }));
        expect((await call('13720000')).status).toBe(502);
    });
});
