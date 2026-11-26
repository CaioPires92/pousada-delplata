import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { rate: { findMany: mocks.findMany } } }));

import { getRoomReferencePrices, referencePriceLabel, todayKeySaoPaulo } from './room-from-price';

const NOW = new Date('2026-11-23T15:00:00Z');
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('getRoomReferencePrices', () => {
    beforeEach(() => vi.clearAllMocks());

    it('usa a tarifa que cobre hoje, não o menor valor do calendário', async () => {
        mocks.findMany.mockResolvedValue([
            { roomTypeId: 'a', price: 329, startDate: d('2026-11-01') }, // cobre hoje
            { roomTypeId: 'a', price: 255.5, startDate: d('2027-03-10') }, // mais barata, mas distante
        ]);
        const result = await getRoomReferencePrices([{ id: 'a', basePrice: 299 }], NOW);
        expect(result.get('a')).toEqual({ price: 329, dateKey: '2026-11-23', isToday: true });
    });

    it('sem tarifa hoje, usa a próxima data com tarifa e informa a data', async () => {
        mocks.findMany.mockResolvedValue([
            { roomTypeId: 'a', price: 400, startDate: d('2026-12-20') },
            { roomTypeId: 'a', price: 350, startDate: d('2026-12-05') },
        ]);
        const result = await getRoomReferencePrices([{ id: 'a', basePrice: 299 }], NOW);
        expect(result.get('a')).toEqual({ price: 350, dateKey: '2026-12-05', isToday: false });
    });

    it('empate na mesma data: menor valor; ignora preço inválido', async () => {
        mocks.findMany.mockResolvedValue([
            { roomTypeId: 'a', price: 0, startDate: d('2026-11-01') },
            { roomTypeId: 'a', price: 330, startDate: d('2026-11-01') },
            { roomTypeId: 'a', price: 320, startDate: d('2026-11-10') },
        ]);
        const result = await getRoomReferencePrices([{ id: 'a', basePrice: 299 }], NOW);
        expect(result.get('a')?.price).toBe(320);
    });

    it('sem tarifa cadastrada cai no preço-base, sem data', async () => {
        mocks.findMany.mockResolvedValue([]);
        const result = await getRoomReferencePrices([{ id: 'c', basePrice: 350 }], NOW);
        expect(result.get('c')).toEqual({ price: 350, dateKey: null, isToday: false });
    });

    it('só consulta tarifas de hoje em diante (fuso de São Paulo) e sem venda fechada', async () => {
        mocks.findMany.mockResolvedValue([]);
        // 01:30 UTC de 24/11 ainda é 22:30 de 23/11 em São Paulo
        await getRoomReferencePrices([{ id: 'a', basePrice: 299 }], new Date('2026-11-24T01:30:00Z'));
        const where = mocks.findMany.mock.calls[0][0].where;
        expect(where.stopSell).toBe(false);
        expect(where.endDate.gte.toISOString()).toBe('2026-11-23T00:00:00.000Z');
    });

    it('lista vazia não consulta o banco', async () => {
        expect((await getRoomReferencePrices([])).size).toBe(0);
        expect(mocks.findMany).not.toHaveBeenCalled();
    });
});

describe('referencePriceLabel / todayKeySaoPaulo', () => {
    it('rotula hoje, outra data e preço-base', () => {
        expect(referencePriceLabel({ price: 1, dateKey: '2026-11-23', isToday: true })).toBe('Diária de hoje · 23/11');
        expect(referencePriceLabel({ price: 1, dateKey: '2026-12-05', isToday: false })).toBe('Diária de 05/12');
        expect(referencePriceLabel({ price: 1, dateKey: null, isToday: false })).toBe('Diária base');
    });

    it('usa a data de São Paulo', () => {
        expect(todayKeySaoPaulo(new Date('2026-11-24T01:30:00Z'))).toBe('2026-11-23');
    });
});
