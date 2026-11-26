'use client';

import type { ReactNode } from 'react';
import { CalendarDays, Users } from 'lucide-react';

type AvailabilityBarProps = {
    checkIn: string;
    checkOut: string;
    adults: number;
    childrenCount: number;
    alterControl: ReactNode;
    /** Complemento curto na mesma linha (ex.: "4 acomodações disponíveis"). */
    summaryExtra?: string;
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
    summaryExtra,
}: AvailabilityBarProps) {
    const adultsLabel = `${adults} adulto${adults === 1 ? '' : 's'}`;
    const childrenLabel = `${childrenCount} criança${childrenCount === 1 ? '' : 's'}`;
    const formattedDates = formatCompactDateRange(checkIn, checkOut);

    return (
        <div className="mb-3 flex flex-col gap-2 border-b border-primary/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {formattedDates}
                </span>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" />
                    {`${adultsLabel} · ${childrenLabel}`}
                </span>
                {summaryExtra ? (
                    <>
                        <span aria-hidden="true" className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{summaryExtra}</span>
                    </>
                ) : null}
            </p>
            <div className="shrink-0">{alterControl}</div>
        </div>
    );
}
