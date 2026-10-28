'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarDays, X } from 'lucide-react';
import { trackClickReservar } from '@/lib/analytics';

const DISMISSED_KEY = 'delplata-booking-assistant-dismissed';
const RESERVA_INTERACTION_EVENT = 'reservar-cta-interaction';

function hasLeftHomeHero() {
    const hero = document.querySelector<HTMLElement>('[data-home-hero]');

    if (hero) {
        return hero.getBoundingClientRect().bottom <= 0;
    }

    return window.scrollY > window.innerHeight * 0.9;
}

export default function MobileBookingBar() {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(() => (
        typeof window !== 'undefined' && sessionStorage.getItem(DISMISSED_KEY) === '1'
    ));

    const isExcludedPage = pathname.startsWith('/admin') || pathname.startsWith('/reservar');
    const isHome = pathname === '/';

    useEffect(() => {
        if (isExcludedPage || isDismissed) {
            return;
        }

        if (!isHome) {
            const timer = window.setTimeout(() => setIsVisible(true), 700);
            return () => window.clearTimeout(timer);
        }

        const handleScroll = () => {
            if (hasLeftHomeHero()) {
                setIsVisible(true);
            }
        };

        const handleReservationInteraction = () => {
            if (hasLeftHomeHero()) {
                setIsVisible(true);
            }
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener(RESERVA_INTERACTION_EVENT, handleReservationInteraction);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener(RESERVA_INTERACTION_EVENT, handleReservationInteraction);
        };
    }, [isDismissed, isExcludedPage, isHome]);

    const handleDismiss = () => {
        sessionStorage.setItem(DISMISSED_KEY, '1');
        setIsDismissed(true);
        setIsVisible(false);
    };

    if (isExcludedPage || isDismissed || !isVisible) {
        return null;
    }

    return (
        <>
            <div aria-hidden="true" className="h-[calc(5.25rem+env(safe-area-inset-bottom))] md:hidden" />
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/15 bg-white/96 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(9,9,9,0.10)] backdrop-blur md:hidden">
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center text-primary/55 transition-colors hover:text-primary"
                    aria-label="Fechar lembrete de reserva"
                >
                    <X className="h-4 w-4" />
                </button>
                <p className="mb-2 pr-8 text-center text-xs font-semibold uppercase tracking-[0.14em] text-primary/70">
                    Reserva direta
                </p>
                <Link
                    href="/reservar"
                    onClick={() => trackClickReservar('booking_assistant_mobile')}
                    className="flex min-h-12 items-center justify-center gap-2 bg-primary px-4 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Ver preços e disponibilidade
                </Link>
            </div>
            <aside className="fixed bottom-5 right-5 z-40 hidden w-[280px] border border-primary/15 bg-white p-4 text-primary shadow-[0_12px_32px_rgba(9,9,9,0.14)] md:block">
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center text-primary/45 transition-colors hover:text-primary"
                    aria-label="Fechar lembrete de reserva"
                >
                    <X className="h-4 w-4" />
                </button>
                <p className="pr-8 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-gold)]">
                    Reserva direta
                </p>
                <h2 className="mt-1 pr-8 text-base font-semibold leading-tight">Consulte datas e valores</h2>
                <Link
                    href="/reservar"
                    onClick={() => trackClickReservar('booking_assistant_desktop')}
                    className="mt-3 flex h-10 items-center justify-center gap-2 bg-primary px-4 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Ver disponibilidade
                </Link>
            </aside>
        </>
    );
}
