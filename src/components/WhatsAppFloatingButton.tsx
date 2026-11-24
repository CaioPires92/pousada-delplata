'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SiWhatsapp } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { trackClickWhatsAppFloating } from '@/lib/analytics';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const WHATSAPP_PHONE = '5519999654866';
const WHATSAPP_MESSAGE = 'Olá! Tenho uma dúvida sobre a hospedagem. Já consultei no site, pode me ajudar?';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
const SCROLL_SHOW_THRESHOLD = 0.25;
const RESERVA_INTERACTION_EVENT = 'reservar-cta-interaction';

export default function WhatsAppFloatingButton() {
    const pathname = usePathname();
    const [showByScroll, setShowByScroll] = useState(false);
    const [showByMotorInteraction, setShowByMotorInteraction] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollableHeight <= 0) return;
            const scrollProgress = window.scrollY / scrollableHeight;
            if (scrollProgress >= SCROLL_SHOW_THRESHOLD) {
                setShowByScroll(true);
            }
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleMotorInteraction = () => setShowByMotorInteraction(true);
        window.addEventListener(RESERVA_INTERACTION_EVENT, handleMotorInteraction);
        return () => window.removeEventListener(RESERVA_INTERACTION_EVENT, handleMotorInteraction);
    }, []);

    const shouldShow = showByScroll || showByMotorInteraction;
    if (!shouldShow) return null;

    const isReservationPage = pathname.startsWith('/reservar');
    const hasBookingAssistant = !pathname.startsWith('/admin') && !isReservationPage;

    return (
        <div className={`fixed z-50 ${hasBookingAssistant ? 'bottom-28 right-4 md:bottom-6 md:right-6' : 'bottom-4 right-4 md:bottom-6 md:right-6'}`}>
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <div className="flex items-center gap-2">
                        <span className={`md:hidden rounded-full border border-emerald-200/40 bg-emerald-950/85 px-2.5 py-1 text-xs font-medium text-emerald-50 ${isReservationPage ? 'hidden' : ''}`}>
                            Dúvidas? Fale conosco
                        </span>
                        <TooltipTrigger asChild>
                            <Button
                                asChild
                                size="icon"
                                className="relative h-12 w-12 md:h-14 md:w-14 rounded-full bg-[#25D366] p-0 text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)] focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:scale-105 hover:bg-[#20bd5a]"
                            >
                                <Link
                                    href={WHATSAPP_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Dúvidas? Fale conosco no WhatsApp"
                                    onClick={() => trackClickWhatsAppFloating('floating')}
                                >
                                    <SiWhatsapp aria-hidden="true" className="h-6 w-6 md:h-7 md:w-7" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                    </div>
                    <TooltipContent
                        side="top"
                        align="end"
                        sideOffset={12}
                        className="border-emerald-100/40 bg-emerald-950/90 text-emerald-50 shadow-lg"
                    >
                        Dúvidas? Fale conosco
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}
