'use client';

import homeStyles from "@/components/home-novo/home-novo.module.css";
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { buildReservarUrl, type SpecialDateConfig } from '@/constants/specialDates';
import { useCurrentDateKey } from '@/hooks/useCurrentDateKey';

type SpecialDatesSectionProps = {
    dates: SpecialDateConfig[];
    onDateClick?: (specialDate: SpecialDateConfig) => void;
};

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

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
    const fromMonth = monthFormatter.format(from).replace('.', '').toUpperCase();
    const toMonth = monthFormatter.format(to).replace('.', '').toUpperCase();

    if (fromDay === toDay && fromMonth === toMonth) return `${fromDay} ${fromMonth}`;
    if (fromMonth === toMonth) return `${fromDay} - ${toDay} ${fromMonth}`;
    return `${fromDay} ${fromMonth} - ${toDay} ${toMonth}`;
}

function getSpecialDateHref(specialDate: SpecialDateConfig) {
    return specialDate.useBaseReservarPath
        ? '/reservar'
        : buildReservarUrl({
            checkIn: specialDate.dateFrom,
            checkOut: specialDate.dateTo,
            adults: 2,
            children: 0,
        });
}

// Próximos feriados: texto e lista de datas à esquerda, foto grande à direita (a foto troca com a data).
export default function SpecialDatesSection({ dates, onDateClick }: SpecialDatesSectionProps) {
    const currentDateKey = useCurrentDateKey();
    const enabledDates = useMemo(
        () => dates
            .filter((item) => item.enabled && (!currentDateKey || (item.dateTo || item.dateFrom) >= currentDateKey))
            .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
            .slice(0, 3),
        [currentDateKey, dates]
    );
    const [activeDateId, setActiveDateId] = useState(enabledDates[0]?.id ?? null);

    const activeDate = enabledDates.find((item) => item.id === activeDateId) ?? enabledDates[0] ?? null;

    if (!activeDate) return null;

    const minNightsLabel = activeDate.minNights
        ? `Estadia mínima de ${activeDate.minNights} noite${activeDate.minNights > 1 ? 's' : ''}`
        : null;
    const activeHref = getSpecialDateHref(activeDate);
    const hasAnyImage = enabledDates.some((item) => item.image);

    return (
        <section className={`${homeStyles.fit} relative bg-[color:var(--brand-forest)] text-white md:pb-10 md:pt-[104px]`}>
            <div className="container grid min-h-0 gap-8 py-10 md:h-full md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-stretch md:gap-14 md:py-0">
                <div className="flex min-h-0 flex-col justify-center gap-7">
                    <div>
                        <p className={`${homeStyles.eyebrow} text-[color:var(--brand-gold)]`}>Datas especiais</p>
                        <h2 className={`${homeStyles.display} mt-4 text-[clamp(2.2rem,min(5vw,8vh),4.4rem)]`}>
                            Próximos <em>feriados</em>
                        </h2>
                    </div>

                    <div role="group" aria-label="Datas especiais" className="border-t border-white/15">
                        {enabledDates.map((specialDate) => {
                            const isActive = specialDate.id === activeDate.id;

                            return (
                                <button
                                    key={specialDate.id}
                                    type="button"
                                    aria-pressed={isActive}
                                    onClick={() => setActiveDateId(specialDate.id)}
                                    aria-label={`${formatSpecialDatePeriod(specialDate)} ${specialDate.title}`}
                                    className={`group flex w-full items-center justify-between gap-4 border-b border-white/15 py-4 pl-4 pr-2 text-left transition-colors duration-300 ${isActive ? 'bg-white/[0.07] shadow-[inset_4px_0_0_var(--brand-gold)]' : 'hover:bg-white/[0.04]'}`}
                                >
                                    <span className="min-w-0">
                                        <span className={`${homeStyles.display} block text-[clamp(1.4rem,min(2.6vw,4.4vh),2.2rem)] ${isActive ? 'text-[color:var(--brand-gold)]' : 'text-white/80'}`}>
                                            {specialDate.title}
                                        </span>
                                        <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">{formatSpecialDatePeriod(specialDate)}</span>
                                    </span>
                                    <ArrowRight
                                        aria-hidden="true"
                                        className={`h-5 w-5 shrink-0 transition-all duration-300 ${isActive ? 'translate-x-0 text-[color:var(--brand-gold)] opacity-100' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-60'}`}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    <div>
                        <p className="max-w-[46ch] text-base leading-7 text-white/80">
                            {activeDate.bannerLabel || activeDate.description}
                            {minNightsLabel ? <span className="mt-1 block text-sm text-white/65">{minNightsLabel}</span> : null}
                        </p>
                        <Link
                            href={activeHref}
                            onClick={() => onDateClick?.(activeDate)}
                            className="mt-5 inline-flex h-12 items-center gap-3 bg-[color:var(--brand-gold)] px-7 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-forest)] transition-opacity hover:opacity-90"
                        >
                            Ver disponibilidade
                            <ArrowRight className="h-4 w-4" strokeWidth={2} />
                        </Link>
                    </div>
                </div>

                <div className="relative aspect-[1.4/1] overflow-hidden bg-[color:var(--brand-black)] md:aspect-auto md:min-h-0">
                    {hasAnyImage ? (
                        enabledDates.map((specialDate) =>
                            specialDate.image ? (
                                <Image
                                    key={specialDate.id}
                                    src={specialDate.image}
                                    alt={specialDate.title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 52vw"
                                    quality={82}
                                    className={`object-cover transition-opacity duration-700 ${specialDate.id === activeDate.id ? 'opacity-100' : 'opacity-0'}`}
                                />
                            ) : null
                        )
                    ) : (
                        <div className="flex h-full min-h-[200px] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(187,184,99,0.24),transparent_45%)]">
                            <CalendarDays className="h-14 w-14 text-[color:var(--brand-gold)]" strokeWidth={1.5} />
                        </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,18,0)_55%,rgba(20,28,18,0.55)_100%)]" />
                </div>
            </div>
        </section>
    );
}
