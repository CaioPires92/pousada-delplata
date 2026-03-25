'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MoonStar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
    const month = monthFormatter.format(from).replace('.', '');
    if (fromDay === toDay) return `${fromDay} ${month}`;
    return `${fromDay}-${toDay} ${month}`;
}

export default function SpecialDatesSection({ dates, onDateClick }: SpecialDatesSectionProps) {
    const enabledDates = dates.filter((item) => item.enabled);
    const sliderRef = useRef<HTMLDivElement | null>(null);
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(enabledDates.length > 1);

    const updateScrollState = useCallback(() => {
        const container = sliderRef.current;
        if (!container) {
            setCanScrollPrev(false);
            setCanScrollNext(false);
            return;
        }

        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        setCanScrollPrev(container.scrollLeft > 4);
        setCanScrollNext(container.scrollLeft < maxScrollLeft - 4);
    }, []);

    const handleScroll = useCallback((direction: 'prev' | 'next') => {
        const container = sliderRef.current;
        if (!container) return;
        const offset = Math.max(320, Math.round(container.clientWidth * 0.9));
        container.scrollBy({
            left: direction === 'next' ? offset : -offset,
            behavior: 'smooth',
        });
    }, []);

    useEffect(() => {
        const container = sliderRef.current;
        if (!container) return;
        const frame = window.requestAnimationFrame(() => {
            updateScrollState();
        });

        const onScroll = () => updateScrollState();
        const onResize = () => updateScrollState();

        container.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        return () => {
            window.cancelAnimationFrame(frame);
            container.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
        };
    }, [enabledDates.length, updateScrollState]);

    if (enabledDates.length === 0) return null;

    return (
        <section className="border-b border-border/60 bg-slate-50/80 py-12 md:py-14">
            <div className="container space-y-8">
                <div className="space-y-4 text-center">
                    <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <CalendarDays className="h-3.5 w-3.5" />
                        </span>
                        Datas especiais
                    </div>
                    <h2 className="text-2xl font-bold font-heading text-slate-900 md:text-3xl">Próximas Datas Especiais</h2>
                    <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
                        Alta procura para os próximos feriados. Garanta sua hospedagem.
                    </p>
                    <Separator />
                </div>

                <div className="flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleScroll('prev')}
                        disabled={!canScrollPrev}
                        aria-label="Ver datas anteriores"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleScroll('next')}
                        disabled={!canScrollNext}
                        aria-label="Ver próximas datas"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div
                    ref={sliderRef}
                    className="flex items-stretch snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                    {enabledDates.map((specialDate) => {
                        const href = specialDate.useBaseReservarPath
                            ? '/reservar'
                            : buildReservarUrl({
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
                                className="relative h-[500px] w-[84%] shrink-0 snap-start rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg sm:h-[520px] sm:w-[66%] md:w-[48%] lg:h-[540px] lg:w-[32%]"
                            >
                                {specialDate.image ? (
                                    <div className="relative w-full h-44 overflow-hidden rounded-t-xl sm:h-52 lg:h-56">
                                        <Image
                                            src={specialDate.image}
                                            alt={specialDate.title}
                                            width={1200}
                                            height={675}
                                            className="h-full w-full object-cover"
                                            sizes="(max-width: 768px) 100vw, 33vw"
                                        />
                                    </div>
                                ) : null}

                                <div className="p-4 pb-24">
                                    <Badge variant="secondary" className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {formatSpecialDatePeriod(specialDate)}
                                    </Badge>
                                    <h3 className="min-h-[3.25rem] text-lg font-semibold text-slate-900 line-clamp-2">{specialDate.title}</h3>
                                    <p className="mt-2 min-h-[3rem] overflow-hidden text-sm text-slate-600 line-clamp-2">{specialDate.description}</p>
                                    {minNightsLabel ? (
                                        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                            <MoonStar className="h-3.5 w-3.5" />
                                            <span>{minNightsLabel}</span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="absolute left-4 right-4 bottom-4">
                                    <Button asChild className="h-11 w-full rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2">
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
