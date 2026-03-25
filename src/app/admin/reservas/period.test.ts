import { describe, expect, it } from 'vitest';
import { buildBookingsQuery } from './period';

describe('period filters', () => {
    it('monta query params do filtro mensal com status', () => {
        const query = buildBookingsQuery({
            status: 'PENDING',
            mode: 'month',
            anchorDate: new Date('2026-03-15T12:00:00.000Z'),
            dateField: 'checkIn',
        });

        const params = new URLSearchParams(query);
        expect(params.get('status')).toBe('PENDING');
        expect(params.get('dateField')).toBe('checkIn');
        expect(params.get('dateFrom')).toBe('2026-03-01');
        expect(params.get('dateTo')).toBe('2026-03-31');
    });

    it('mantém fallback seguro sem filtro de data quando intervalo é inválido', () => {
        const query = buildBookingsQuery({
            status: 'ALL',
            mode: 'range',
            anchorDate: new Date('2026-03-15T12:00:00.000Z'),
            customFrom: '2026-03-20',
            customTo: '2026-03-01',
            dateField: 'checkIn',
        });

        const params = new URLSearchParams(query);
        expect(params.has('dateFrom')).toBe(false);
        expect(params.has('dateTo')).toBe(false);
    });
});
