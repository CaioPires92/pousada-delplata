'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { trackClickReservar } from '@/lib/analytics';

export default function MobileBookingBar() {
    const pathname = usePathname();

    if (pathname.startsWith('/admin') || pathname.startsWith('/reservar')) {
        return null;
    }

    return (
        <>
            <div aria-hidden="true" className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" />
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/15 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(9,9,9,0.10)] backdrop-blur md:hidden">
                <Link
                    href="/reservar"
                    onClick={() => trackClickReservar('mobile_sticky')}
                    className="flex min-h-12 items-center justify-center gap-2 bg-primary px-4 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Ver preços e disponibilidade
                </Link>
            </div>
        </>
    );
}
