import { describe, expect, it } from 'vitest';
import {
    buildReservarUrl,
    getActiveBannerSpecialDate,
    type SpecialDateConfig,
} from './specialDates';

describe('specialDates helpers', () => {
    it('buildReservarUrl gera query correta com datas válidas', () => {
        const url = buildReservarUrl({
            checkIn: '2026-06-04',
            checkOut: '2026-06-07',
            adults: 2,
            children: 1,
        });

        expect(url).toBe('/reservar?checkIn=2026-06-04&checkOut=2026-06-07&adults=2&children=1');
    });

    it('buildReservarUrl faz fallback para /reservar quando datas são inválidas', () => {
        const url = buildReservarUrl({
            checkIn: '2026-06-07',
            checkOut: '2026-06-04',
            adults: 2,
            children: 0,
        });
        expect(url).toBe('/reservar');
    });

    it('getActiveBannerSpecialDate retorna feriado ativo na janela configurada', () => {
        const dates: SpecialDateConfig[] = [
            {
                id: 'corpus',
                title: 'Corpus Christi',
                description: 'Alta procura',
                dateFrom: '2026-06-04',
                dateTo: '2026-06-07',
                enabled: true,
            },
        ];

        const active = getActiveBannerSpecialDate(new Date('2026-05-20T12:00:00.000Z'), {
            leadDays: 30,
            dates,
        });

        expect(active?.id).toBe('corpus');
    });

    it('getActiveBannerSpecialDate retorna null fora da janela de exibição', () => {
        const dates: SpecialDateConfig[] = [
            {
                id: 'corpus',
                title: 'Corpus Christi',
                description: 'Alta procura',
                dateFrom: '2026-06-04',
                dateTo: '2026-06-07',
                enabled: true,
            },
        ];

        const active = getActiveBannerSpecialDate(new Date('2026-04-01T12:00:00.000Z'), {
            leadDays: 30,
            dates,
        });

        expect(active).toBeNull();
    });
});
