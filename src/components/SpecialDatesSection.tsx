'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, MoonStar } from 'lucide-react';
import { buildReservarUrl, type SpecialDateConfig } from '@/constants/specialDates';

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

export default function SpecialDatesSection({ dates, onDateClick }: SpecialDatesSectionProps) {
    const enabledDates = useMemo(
        () => dates.filter((item) => item.enabled).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)).slice(0, 3),
        [dates]
    );
    const [activeDateId, setActiveDateId] = useState(enabledDates[0]?.id ?? null);

    const activeDate = enabledDates.find((item) => item.id === activeDateId) ?? enabledDates[0] ?? null;

    if (!activeDate) return null;

    const minNightsLabel = activeDate.minNights
        ? `Estadia mínima ${activeDate.minNights} noite${activeDate.minNights > 1 ? 's' : ''}`
        : null;
    const activeHref = getSpecialDateHref(activeDate);

    return (
        <section className="section-space-sm border-b border-primary/10 bg-background">
            <div className="container">
                <div className="mx-auto max-w-[1180px]">
                    <div className="mb-8 flex justify-center md:mb-10">
                        <div className="inline-flex items-center gap-3 rounded-none border border-primary/10 bg-[color:var(--brand-white)] px-5 py-2 font-sans text-[0.75rem] font-medium uppercase tracking-[0.14em] text-primary/90">
                            <CalendarDays className="h-4 w-4 text-secondary" strokeWidth={1.8} />
                            Datas especiais
                        </div>
                    </div>

                    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)] lg:items-center lg:gap-12">
                        <div className="max-w-[20rem] space-y-5 xl:max-w-[21rem]">
                            <h2 className="font-hero-display max-w-[10ch] text-[2.25rem] font-semibold leading-[0.95] text-primary sm:text-[2.75rem] lg:text-[3.15rem] xl:text-[3.35rem]">
                                Próximos feriados
                            </h2>
                            <div className="h-px w-20 bg-secondary/70" />
                            <p className="max-w-[19rem] font-sans text-[1rem] leading-7 text-foreground/72">
                                Consulte datas de feriados e veja as acomodações disponíveis no motor de reservas.
                            </p>
                        </div>

                        <div className="relative overflow-hidden rounded-none border border-primary/10 bg-[color:var(--brand-cream)] lg:max-w-[56rem]">
                            {activeDate.image ? (
                                <div className="relative aspect-[1.3/1] min-h-[320px] w-full lg:aspect-[1.38/1]">
                                    <Image
                                        src={activeDate.image}
                                        alt={activeDate.title}
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 62vw"
                                        className="object-cover"
                                        quality={82}
                                    />
                                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,9,0.04)_0%,rgba(9,9,9,0.16)_100%)]" />
                                </div>
                            ) : (
                                <div className="flex min-h-[320px] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(187,184,99,0.24),transparent_45%),linear-gradient(180deg,rgba(187,184,99,0.16)_0%,rgba(187,184,99,0.08)_100%)]">
                                    <CalendarDays className="h-14 w-14 text-secondary" strokeWidth={1.5} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-10 overflow-hidden rounded-none border border-primary/10 bg-white">
                        <div className="grid md:grid-cols-3">
                            {enabledDates.map((specialDate, index) => {
                                const isActive = specialDate.id === activeDate.id;

                                return (
                                    <button
                                        key={specialDate.id}
                                        type="button"
                                        onClick={() => setActiveDateId(specialDate.id)}
                                        aria-label={`${formatSpecialDatePeriod(specialDate)} ${specialDate.title}`}
                                        className={`flex w-full items-center gap-5 px-6 py-7 text-left transition-colors duration-200 md:px-7 ${isActive ? 'bg-secondary/10' : 'bg-transparent hover:bg-secondary/5'
                                            } ${index < enabledDates.length - 1 ? 'border-b border-primary/10 md:border-b-0 md:border-r md:border-primary/10' : ''}`}
                                    >
                                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-none bg-secondary/12 text-secondary">
                                            <CalendarDays className="h-7 w-7" strokeWidth={1.6} />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block font-sans text-[0.88rem] font-semibold uppercase tracking-[0.12em] text-primary/90">
                                                {formatSpecialDatePeriod(specialDate)}
                                            </span>
                                            <span className="mt-1 block font-sans text-[1.15rem] font-semibold leading-[1.15] text-foreground">
                                                {specialDate.title}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6 rounded-none border border-primary/10 bg-[color:var(--brand-white)] px-6 py-6 text-primary md:px-10 md:py-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-4">
                                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-none border border-secondary/30 bg-white text-secondary">
                                    <CalendarDays className="h-7 w-7" strokeWidth={1.7} />
                                </span>
                                <div className="space-y-1.5">
                                    <p className="font-sans text-[1.7rem] font-semibold leading-tight text-primary">
                                        Consulte disponibilidade para essas datas
                                    </p>
                                    <p className="font-sans text-[1rem] leading-7 text-primary/84">
                                        {activeDate.bannerLabel || activeDate.description}
                                    </p>
                                    {minNightsLabel ? (
                                        <div className="inline-flex items-center gap-2 pt-1 font-sans text-sm text-primary/82">
                                            <MoonStar className="h-4 w-4 text-secondary" strokeWidth={1.8} />
                                            <span>{minNightsLabel}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <Link
                                href={activeHref}
                                onClick={() => onDateClick?.(activeDate)}
                                className="inline-flex h-16 items-center justify-center gap-4 rounded-none border border-primary bg-primary px-8 font-sans text-[0.95rem] font-semibold uppercase tracking-[0.12em] text-white transition-colors duration-300 hover:bg-primary/90 lg:min-w-[320px]"
                            >
                                Ver disponibilidade
                                <ArrowRight className="h-5 w-5 text-secondary" strokeWidth={1.8} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
