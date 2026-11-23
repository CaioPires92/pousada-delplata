import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { rate: { findMany: mocks.findMany } } }));

import { getRoomFromPrices } from './room-from-price';

describe('getRoomFromPrices', () => {
    beforeEach(() => vi.clearAllMocks());

    it('usa o menor preço das tarifas futuras de cada quarto', async () => {
        mocks.findMany.mockResolvedValue([
            { roomTypeId: 'a', price: 310 },
            { roomTypeId: 'a', price: 255.5 },
            { roomTypeId: 'b', price: '420' },
        ]);
        const result = await getRoomFromPrices([{ id: 'a', basePrice: 299 }, { id: 'b', basePrice: 309 }]);
        expect(result.get('a')).toBe(255.5);
        expect(result.get('b')).toBe(420);
    });

    it('sem tarifa cadastrada cai no preço-base e ignora valores inválidos', async () => {
        mocks.findMany.mockResolvedValue([{ roomTypeId: 'a', price: 0 }]);
        const result = await getRoomFromPrices([{ id: 'a', basePrice: 299 }, { id: 'c', basePrice: 350 }]);
        expect(result.get('a')).toBe(299);
        expect(result.get('c')).toBe(350);
    });

    it('só consulta tarifas de hoje em diante e sem venda fechada', async () => {
        mocks.findMany.mockResolvedValue([]);
        await getRoomFromPrices([{ id: 'a', basePrice: 299 }], new Date('2026-11-23T15:00:00Z'));
        const where = mocks.findMany.mock.calls[0][0].where;
        expect(where.stopSell).toBe(false);
        expect(where.endDate.gte.toISOString()).toBe('2026-11-23T00:00:00.000Z');
    });

    it('lista vazia não consulta o banco', async () => {
        expect((await getRoomFromPrices([])).size).toBe(0);
        expect(mocks.findMany).not.toHaveBeenCalled();
    });
});
