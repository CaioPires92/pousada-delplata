import { compareDayKey, nextDayKey, prevDayKey } from '@/lib/day-key';

/** Intervalo de datas (AAAA-MM-DD) com as duas pontas inclusivas. */
export type DayRange = { from: string; to: string };

/** Ordena e junta intervalos que se sobrepõem ou são vizinhos (25/11 + 26/11 viram 25/11 a 26/11). */
export function normalizeRanges(ranges: DayRange[]): DayRange[] {
    const sorted = ranges
        .filter((range) => compareDayKey(range.from, range.to) <= 0)
        .map((range) => ({ ...range }))
        .sort((a, b) => compareDayKey(a.from, b.from) || compareDayKey(a.to, b.to));

    const merged: DayRange[] = [];
    for (const range of sorted) {
        const last = merged[merged.length - 1];
        if (last && compareDayKey(range.from, nextDayKey(last.to)) <= 0) {
            if (compareDayKey(range.to, last.to) > 0) last.to = range.to;
        } else {
            merged.push(range);
        }
    }
    return merged;
}

export function isDayInRanges(ranges: DayRange[], day: string): boolean {
    return ranges.some((range) => compareDayKey(range.from, day) <= 0 && compareDayKey(range.to, day) >= 0);
}

/**
 * Clique num dia do calendário: se o dia está removido, ele volta (o intervalo se divide);
 * se não está, ele é removido (e junta com os vizinhos).
 */
export function toggleDayInRanges(ranges: DayRange[], day: string): DayRange[] {
    if (!isDayInRanges(ranges, day)) return normalizeRanges([...ranges, { from: day, to: day }]);

    const result: DayRange[] = [];
    for (const range of ranges) {
        if (!(compareDayKey(range.from, day) <= 0 && compareDayKey(range.to, day) >= 0)) {
            result.push(range);
            continue;
        }
        if (compareDayKey(range.from, day) < 0) result.push({ from: range.from, to: prevDayKey(day) });
        if (compareDayKey(range.to, day) > 0) result.push({ from: nextDayKey(day), to: range.to });
    }
    return normalizeRanges(result);
}

/** Quantos dias os intervalos cobrem no total. */
export function countDaysInRanges(ranges: DayRange[]): number {
    return normalizeRanges(ranges).reduce((sum, range) => {
        const [fy, fm, fd] = range.from.split('-').map(Number);
        const [ty, tm, td] = range.to.split('-').map(Number);
        return sum + Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1;
    }, 0);
}
