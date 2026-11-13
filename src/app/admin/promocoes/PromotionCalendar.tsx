'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isDayInRanges, toggleDayInRanges, type DayRange } from '@/lib/promotions/day-ranges';

type Props = {
    /** Período de estadia da promoção ('' = sem limite). Dias fora dele aparecem cinza. */
    stayStart: string;
    stayEnd: string;
    /** Dias da semana em que a promoção vale (0 = domingo … 6 = sábado). Os outros aparecem cinza. */
    daysOfWeek: number[];
    /** Dias removidos da promoção. */
    excluded: DayRange[];
    /** "Hoje" no fuso da pousada (AAAA-MM-DD). Dias passados não podem ser alterados. */
    today: string;
    onChange: (ranges: DayRange[]) => void;
};

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEK_HEADER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const monthKeyOf = (dayKey: string) => dayKey.slice(0, 7);
const shiftMonth = (monthKey: string, delta: number) => {
    const [year, month] = monthKey.split('-').map(Number);
    const index = year * 12 + (month - 1) + delta;
    return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
};
const dayBR = (dayKey: string) => dayKey.split('-').reverse().join('/');
const weekdayOf = (dayKey: string) => {
    const [y, m, d] = dayKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** Dias do mês numa grade começando na segunda-feira (null = célula vazia). */
function buildMonthGrid(monthKey: string): Array<string | null> {
    const [year, month] = monthKey.split('-').map(Number);
    const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // segunda = 0
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: Array<string | null> = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(`${monthKey}-${pad2(day)}`);
    return cells;
}

type CellState = 'past' | 'outside' | 'weekdayOff' | 'removed' | 'applied';

function MonthView({ monthKey, stateOf, onToggle }: { monthKey: string; stateOf: (day: string) => CellState; onToggle: (day: string) => void }) {
    const [year, month] = monthKey.split('-').map(Number);
    return (
        <div>
            <p className="mb-2 text-center text-sm font-bold capitalize text-slate-800">{MONTH_NAMES[month - 1]} de {year}</p>
            <div className="grid grid-cols-7 gap-1 text-center">
                {WEEK_HEADER.map((label) => (
                    <span key={label} className="text-[11px] font-semibold uppercase text-slate-500">{label}</span>
                ))}
                {buildMonthGrid(monthKey).map((day, index) => {
                    if (!day) return <span key={`blank-${index}`} />;
                    const state = stateOf(day);
                    const clickable = state === 'applied' || state === 'removed';
                    const base = 'h-9 w-full rounded-md text-sm transition-colors';
                    const style =
                        state === 'applied'
                            ? 'bg-emerald-600 font-bold text-white hover:bg-emerald-700'
                            : state === 'removed'
                                ? 'border border-slate-300 bg-white text-slate-400 line-through hover:bg-slate-50'
                                : state === 'weekdayOff'
                                    ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                                    : 'cursor-not-allowed text-slate-300';
                    const hint =
                        state === 'applied' ? 'com desconto, clique para remover'
                            : state === 'removed' ? 'removido, clique para voltar'
                                : state === 'weekdayOff' ? 'dia da semana desmarcado'
                                    : state === 'outside' ? 'fora do período da promoção'
                                        : 'data passada';
                    return (
                        <button
                            key={day}
                            type="button"
                            disabled={!clickable}
                            data-state={state}
                            aria-label={`${dayBR(day)}: ${hint}`}
                            aria-pressed={state === 'applied' ? true : state === 'removed' ? false : undefined}
                            onClick={() => onToggle(day)}
                            className={`${base} ${style}`}
                        >
                            {Number(day.slice(8, 10))}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Calendário de 2 meses para tirar dias da promoção com um clique (como no Booking, mas sem CTRL).
 * Azul/verde = a promoção vale naquela noite; branco riscado = removido por você; cinza = fora do
 * período, dia da semana desmarcado ou data passada.
 */
export default function PromotionCalendar({ stayStart, stayEnd, daysOfWeek, excluded, today, onChange }: Props) {
    const anchor = stayStart && stayStart > today ? stayStart : today;
    const [firstMonth, setFirstMonth] = useState(() => monthKeyOf(anchor));

    const stateOf = useMemo(
        () => (day: string): CellState => {
            if (day < today) return 'past';
            if ((stayStart && day < stayStart) || (stayEnd && day > stayEnd)) return 'outside';
            if (daysOfWeek.length > 0 && !daysOfWeek.includes(weekdayOf(day))) return 'weekdayOff';
            return isDayInRanges(excluded, day) ? 'removed' : 'applied';
        },
        [today, stayStart, stayEnd, daysOfWeek, excluded]
    );

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3" data-testid="promo-calendar">
            <div className="mb-2 flex items-center justify-between">
                <button type="button" onClick={() => setFirstMonth((m) => shiftMonth(m, -1))} aria-label="Mês anterior" className="rounded-md p-1 text-slate-600 hover:bg-slate-100">
                    <ChevronLeft size={18} />
                </button>
                <p className="text-xs text-slate-500">Clique num dia para tirar a promoção dele; clique de novo para voltar.</p>
                <button type="button" onClick={() => setFirstMonth((m) => shiftMonth(m, 1))} aria-label="Próximo mês" className="rounded-md p-1 text-slate-600 hover:bg-slate-100">
                    <ChevronRight size={18} />
                </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
                <MonthView monthKey={firstMonth} stateOf={stateOf} onToggle={(day) => onChange(toggleDayInRanges(excluded, day))} />
                <MonthView monthKey={shiftMonth(firstMonth, 1)} stateOf={stateOf} onToggle={(day) => onChange(toggleDayInRanges(excluded, day))} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-600" /> Com desconto</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-slate-300 bg-white" /> Removido por você</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-slate-200" /> Fora do período, dia da semana desmarcado ou data passada</span>
            </div>
        </div>
    );
}
