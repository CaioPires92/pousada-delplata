'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarDays, ShieldCheck, X } from 'lucide-react';
import { trackClickReservar } from '@/lib/analytics';

const DISMISSED_KEY = 'delplata-booking-assistant-dismissed';
const HOME_SCROLL_THRESHOLD = 0.18;
const RESERVA_INTERACTION_EVENT = 'reservar-cta-interaction';

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
            const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
            if (progress >= HOME_SCROLL_THRESHOLD || window.scrollY > 420) {
                setIsVisible(true);
            }
        };

        const handleReservationInteraction = () => setIsVisible(true);

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
            <aside className="fixed bottom-6 right-6 z-40 hidden w-[320px] border border-white/18 bg-[#283223] text-white shadow-[0_24px_70px_rgba(0,0,0,0.30)] md:block">
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-white/60 transition-colors hover:text-white"
                    aria-label="Fechar lembrete de reserva"
                >
                    <X className="h-4 w-4" />
                </button>
                <div className="border-b border-white/15 px-5 py-4 pr-12">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
                        Reserva direta
                    </p>
                    <h2 className="mt-1 text-lg font-semibold leading-tight">Consulte datas e valores</h2>
                    <p className="mt-1 text-sm leading-5 text-white/72">
                        Veja disponibilidade online antes de decidir.
                    </p>
                </div>
                <div className="space-y-4 p-5">
                    <div className="flex items-start gap-3 text-sm leading-5 text-white/78">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-gold)]" />
                        <span>Café da manhã, total da estadia e pagamento aparecem antes de finalizar.</span>
                    </div>
                    <Link
                        href="/reservar"
                        onClick={() => trackClickReservar('booking_assistant_desktop')}
                        className="flex h-12 items-center justify-center gap-2 bg-[color:var(--brand-gold)] px-4 text-center text-sm font-semibold text-[#283223] transition-colors hover:bg-[color:var(--brand-gold)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#283223]"
                    >
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        Ver disponibilidade
                    </Link>
                </div>
            </aside>
        </>
    );
}
