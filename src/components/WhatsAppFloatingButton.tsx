'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
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

    return (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <div className="flex items-center gap-2">
                        <span className="md:hidden rounded-full border border-emerald-200/40 bg-emerald-950/85 px-2.5 py-1 text-xs font-medium text-emerald-50">
                            Dúvidas? Fale conosco
                        </span>
                        <TooltipTrigger asChild>
                            <Button
                                asChild
                                size="icon"
                                className="relative h-10 w-10 md:h-12 md:w-12 rounded-full bg-emerald-500 p-2 text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)] ring-1 ring-white/35 focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors duration-200 hover:bg-emerald-600"
                            >
                                <Link
                                    href={WHATSAPP_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Dúvidas? Fale conosco no WhatsApp"
                                    onClick={() => trackClickWhatsAppFloating('floating')}
                                >
                                    <MessageCircle className="h-[18px] w-[18px] md:h-5 md:w-5" />
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
