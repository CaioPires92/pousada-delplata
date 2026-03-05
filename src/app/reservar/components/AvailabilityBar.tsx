'use client';

import type { ReactNode } from 'react';
import { CalendarDays, Users } from 'lucide-react';

type AvailabilityBarProps = {
    checkIn: string;
    checkOut: string;
    adults: number;
    childrenCount: number;
    alterControl: ReactNode;
};

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

function parseYmd(value: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function capitalize(value: string) {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMonthShort(date: Date) {
    return capitalize(monthFormatter.format(date).replace('.', ''));
}

function formatCompactDateRange(checkIn: string, checkOut: string) {
    const from = parseYmd(checkIn);
    const to = parseYmd(checkOut);
    if (!from || !to) return `${checkIn} - ${checkOut}`;

    const fromDay = String(from.getUTCDate()).padStart(2, '0');
    const toDay = String(to.getUTCDate()).padStart(2, '0');
    const fromMonth = formatMonthShort(from);
    const toMonth = formatMonthShort(to);

    if (fromMonth === toMonth) return `${fromDay}-${toDay} ${fromMonth}`;
    return `${fromDay} ${fromMonth} - ${toDay} ${toMonth}`;
}

export default function AvailabilityBar({
    checkIn,
    checkOut,
    adults,
    childrenCount,
    alterControl,
}: AvailabilityBarProps) {
    const adultsLabel = `${adults} adulto${adults === 1 ? '' : 's'}`;
    const childrenLabel = `${childrenCount} criança${childrenCount === 1 ? '' : 's'}`;
    const formattedDates = formatCompactDateRange(checkIn, checkOut);

    return (
        <div className="mb-4 rounded-xl border border-border/40 bg-card px-4 py-3 shadow-sm">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Busca Atual</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-sm font-medium text-foreground">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span>{formattedDates}</span>
                    </div>
                    <div className="hidden h-4 w-px bg-border sm:block" />
                    <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-sm font-medium text-foreground">
                        <Users className="h-4 w-4 text-primary" />
                        <span>{`${adultsLabel} · ${childrenLabel}`}</span>
                    </div>
                </div>
                <div className="shrink-0">{alterControl}</div>
            </div>
        </div>
    );
}
