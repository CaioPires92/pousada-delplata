import { describe, expect, it } from 'vitest';
import { countDaysInRanges, isDayInRanges, normalizeRanges, toggleDayInRanges, type DayRange } from '@/lib/promotions/day-ranges';

const r = (from: string, to = from): DayRange => ({ from, to });

describe('day-ranges', () => {
    it('normalizeRanges ordena, junta sobrepostos e vizinhos, e descarta inválidos', () => {
        expect(normalizeRanges([r('2026-11-25'), r('2026-11-26'), r('2026-11-14', '2026-11-16'), r('2026-11-15', '2026-11-18')])).toEqual([
            r('2026-11-14', '2026-11-18'),
            r('2026-11-25', '2026-11-26'),
        ]);
        expect(normalizeRanges([r('2026-11-30'), r('2026-12-01')])).toEqual([r('2026-11-30', '2026-12-01')]); // vira o mês
        expect(normalizeRanges([{ from: '2026-11-26', to: '2026-11-25' }])).toEqual([]);
        expect(normalizeRanges([])).toEqual([]);
    });

    it('isDayInRanges inclui as duas pontas', () => {
        const ranges = [r('2026-11-14', '2026-11-16')];
        expect(isDayInRanges(ranges, '2026-11-14')).toBe(true);
        expect(isDayInRanges(ranges, '2026-11-16')).toBe(true);
        expect(isDayInRanges(ranges, '2026-11-13')).toBe(false);
        expect(isDayInRanges(ranges, '2026-11-17')).toBe(false);
    });

    it('toggle: clicar num dia livre remove o dia; clicar de novo traz de volta', () => {
        const removed = toggleDayInRanges([], '2026-11-25');
        expect(removed).toEqual([r('2026-11-25')]);
        expect(toggleDayInRanges(removed, '2026-11-25')).toEqual([]);
    });

    it('toggle: dias vizinhos se juntam num intervalo só', () => {
        let ranges = toggleDayInRanges([], '2026-11-24');
        ranges = toggleDayInRanges(ranges, '2026-11-26');
        ranges = toggleDayInRanges(ranges, '2026-11-25'); // preenche o buraco
        expect(ranges).toEqual([r('2026-11-24', '2026-11-26')]);
    });

    it('toggle: devolver um dia do meio divide o intervalo em dois', () => {
        expect(toggleDayInRanges([r('2026-11-24', '2026-11-28')], '2026-11-26')).toEqual([
            r('2026-11-24', '2026-11-25'),
            r('2026-11-27', '2026-11-28'),
        ]);
        // pontas: só encurta
        expect(toggleDayInRanges([r('2026-11-24', '2026-11-28')], '2026-11-24')).toEqual([r('2026-11-25', '2026-11-28')]);
        expect(toggleDayInRanges([r('2026-11-24', '2026-11-28')], '2026-11-28')).toEqual([r('2026-11-24', '2026-11-27')]);
    });

    it('countDaysInRanges soma os dias sem contar duas vezes', () => {
        expect(countDaysInRanges([])).toBe(0);
        expect(countDaysInRanges([r('2026-11-25')])).toBe(1);
        expect(countDaysInRanges([r('2026-11-14', '2026-11-16'), r('2026-11-25')])).toBe(4);
        expect(countDaysInRanges([r('2026-11-14', '2026-11-16'), r('2026-11-15', '2026-11-17')])).toBe(4);
        expect(countDaysInRanges([r('2026-11-30', '2026-12-02')])).toBe(3);
    });
});
