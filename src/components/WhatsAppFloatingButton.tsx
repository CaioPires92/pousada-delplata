'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Glow } from '@/components/magicui/glow';
import { trackClickWhatsApp } from '@/lib/analytics';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const WHATSAPP_PHONE = '5519999654866';
const WHATSAPP_MESSAGE = 'Olá! Gostaria de informações, por favor.';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export default function WhatsAppFloatingButton() {
    return (
        <div className="fixed bottom-5 right-5 z-50">
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <Glow className="h-14 w-14">
                        <TooltipTrigger asChild>
                            <Button
                                asChild
                                size="icon"
                                className="relative h-14 w-14 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 p-3 text-white shadow-[0_16px_32px_rgba(16,185,129,0.35)] ring-1 ring-white/40 focus-visible:ring-2 focus-visible:ring-emerald-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.05] motion-safe:active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none"
                            >
                                <Link
                                    href={WHATSAPP_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Falar no WhatsApp"
                                    onClick={() => trackClickWhatsApp('botao_whatsapp_fixo')}
                                >
                                    <MessageCircle className="h-6 w-6" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                    </Glow>
                    <TooltipContent
                        side="top"
                        align="end"
                        sideOffset={12}
                        className="border-emerald-100/40 bg-emerald-950/90 text-emerald-50 shadow-lg"
                    >
                        Falar no WhatsApp
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}
