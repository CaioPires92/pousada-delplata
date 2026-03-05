'use client';

import type { ReactNode } from 'react';

type AvailabilityBarProps = {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
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
    children,
    alterControl,
}: AvailabilityBarProps) {
    const adultsLabel = `${adults} adulto${adults === 1 ? '' : 's'}`;
    const childrenLabel = `${children} criança${children === 1 ? '' : 's'}`;
    const formattedDates = formatCompactDateRange(checkIn, checkOut);

    return (
        <div className="mb-6 rounded-xl border border-border/50 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">
                    {`📅 ${formattedDates} • ${adultsLabel} • ${childrenLabel}`}
                </div>
                {alterControl}
            </div>
        </div>
    );
}
