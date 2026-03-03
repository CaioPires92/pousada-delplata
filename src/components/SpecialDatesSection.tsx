'use client';

import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildReservarUrl, type SpecialDateConfig } from '@/constants/specialDates';

type SpecialDatesSectionProps = {
    dates: SpecialDateConfig[];
    onDateClick?: (specialDate: SpecialDateConfig) => void;
};

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

function formatYmdToDate(value: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatSpecialDatePeriod(specialDate: SpecialDateConfig) {
    const from = formatYmdToDate(specialDate.dateFrom);
    const to = formatYmdToDate(specialDate.dateTo || specialDate.dateFrom);
    if (!from || !to) return specialDate.dateFrom;

    const fromDay = String(from.getUTCDate()).padStart(2, '0');
    const toDay = String(to.getUTCDate()).padStart(2, '0');
    const month = monthFormatter.format(from).replace('.', '');
    if (fromDay === toDay) return `${fromDay} ${month}`;
    return `${fromDay}-${toDay} ${month}`;
}

export default function SpecialDatesSection({ dates, onDateClick }: SpecialDatesSectionProps) {
    const enabledDates = dates.filter((item) => item.enabled);
    if (enabledDates.length === 0) return null;

    return (
        <section className="border-b border-border/60 bg-slate-50/80 py-12 md:py-14">
            <div className="container space-y-8">
                <div className="space-y-2 text-center">
                    <h2 className="text-2xl md:text-3xl font-bold font-heading text-slate-900">📅 Próximas Datas Especiais</h2>
                    <p className="text-sm md:text-base text-slate-600">
                        Alta procura para os próximos feriados. Garanta sua hospedagem.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {enabledDates.map((specialDate) => {
                        const href = buildReservarUrl({
                            checkIn: specialDate.dateFrom,
                            checkOut: specialDate.dateTo,
                            adults: 2,
                            children: 0,
                        });
                        const minNightsLabel = specialDate.minNights
                            ? `Estadia mínima ${specialDate.minNights} noite${specialDate.minNights > 1 ? 's' : ''}`
                            : null;

                        return (
                            <article
                                key={specialDate.id}
                                className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                            >
                                {specialDate.image ? (
                                    <div className="relative aspect-[16/9] w-full">
                                        <Image
                                            src={specialDate.image}
                                            alt={specialDate.title}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 100vw, 33vw"
                                        />
                                    </div>
                                ) : null}

                                <div className="p-5">
                                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {formatSpecialDatePeriod(specialDate)}
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900">{specialDate.title}</h3>
                                    <p className="mt-2 text-sm text-slate-600">{specialDate.description}</p>
                                    {minNightsLabel ? (
                                        <p className="mt-3 text-xs font-medium text-slate-500">{minNightsLabel}</p>
                                    ) : null}

                                    <Button asChild className="mt-5 w-full">
                                        <Link href={href} onClick={() => onDateClick?.(specialDate)}>
                                            Ver disponibilidade
                                        </Link>
                                    </Button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
