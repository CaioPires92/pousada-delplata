"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Users, ArrowRight } from "lucide-react";
import { addDays, format, startOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateField } from "@/components/booking-search/DateField";
import { GuestsPanel, type GuestsValue } from "@/components/booking-search/GuestsPanel";
import { buildReservarUrl, toDayKey, validateBookingSearch } from "@/lib/booking-search";
import { trackClickReservar } from "@/lib/analytics";

export default function MobileBookingBar() {
    const pathname = usePathname();
    const router = useRouter();

    const [checkIn, setCheckIn] = useState<Date | undefined>();
    const [checkOut, setCheckOut] = useState<Date | undefined>();
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
    const [guests, setGuests] = useState<GuestsValue>({ adults: 2, children: 0, childrenAges: [], pets: 0 });
    const [error, setError] = useState("");
    const today = startOfDay(new Date());

    // Datas de hoje só no cliente: inicializar no render geraria diferença de hidratação (servidor x navegador).
    useEffect(() => {
        const now = new Date();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCheckIn(now);
        setCheckOut(addDays(now, 1));
    }, []);

    const handleCheckInSelect = (date: Date | undefined) => {
        setCheckIn(date);
        setError("");

        if (!date) return;

        setCheckOut(addDays(date, 1));
        setIsCheckInOpen(false);
        setIsCheckOutOpen(true);
    };

    const isExcludedPage = pathname.startsWith("/admin") || pathname.startsWith("/reservar");

    if (isExcludedPage) {
        return null;
    }

    const handleSimulate = (source: 'booking_assistant_mobile' | 'booking_assistant_desktop') => (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        trackClickReservar(source);
        const values = {
            checkIn: checkIn ? toDayKey(checkIn) : "",
            checkOut: checkOut ? toDayKey(checkOut) : "",
            ...guests,
        };
        const validation = validateBookingSearch(values);
        if (!validation.ok) {
            setError(validation.message);
            return;
        }
        setError("");
        router.push(buildReservarUrl(values));
    };

    const calendarClassNames = {
        caption_label: "text-white font-semibold text-sm",
        head_cell: "text-white/70 font-medium text-[0.7rem] uppercase tracking-wide w-full text-center py-1",
        day: "h-9 w-9 p-0 font-normal text-white hover:bg-white/10 rounded-lg mx-auto",
        day_selected: "bg-brand-gold text-brand-brown-dark font-bold hover:bg-brand-gold/90 hover:text-brand-brown-dark focus:bg-brand-gold focus:text-brand-brown-dark",
        day_today: "bg-white/5 text-white font-bold",
        disabled: "!text-white/35 !opacity-100 cursor-not-allowed",
        nav_button: "h-7 w-7 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center rounded-md"
    };

    const guestsLabel = `${guests.adults} Ad${guests.adults > 1 ? 's' : ''}${guests.children > 0 ? `, ${guests.children} Cr` : ''}${guests.pets > 0 ? `, ${guests.pets} Pet${guests.pets > 1 ? 's' : ''}` : ''}`;

    return (
        <div className="fixed inset-x-0 bottom-0 z-40">
            <div className="w-full bg-primary border-t border-white/15 shadow-2xl relative">
                {error ? (
                    <p role="alert" className="absolute bottom-full left-0 right-0 bg-destructive px-4 py-2 text-center text-xs font-semibold text-white">
                        {error}
                    </p>
                ) : null}
                <div className="flex items-center gap-3 px-3 py-2.5 md:hidden">
                    <div className="min-w-0 flex-1 text-white">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">Reserve direto</p>
                        <p className="text-xs font-semibold">Melhor tarifa</p>
                    </div>
                    <Link
                        href="/reservar"
                        onClick={handleSimulate('booking_assistant_mobile')}
                        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-sm bg-brand-gold px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-brand-brown-dark"
                    >
                        Consultar datas <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
                
                <div className="container mx-auto hidden px-4 py-3 md:flex md:flex-nowrap md:items-center md:justify-end md:gap-4 sm:px-16 lg:justify-center lg:gap-8 lg:px-32">
                    
                    {/* Form Fields container */}
                    <div className="flex flex-1 items-center justify-end gap-2 md:gap-4 lg:gap-8 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                        
                        {/* Check-in */}
                        <DateField
                            value={checkIn}
                            onSelect={handleCheckInSelect}
                            open={isCheckInOpen}
                            onOpenChange={setIsCheckInOpen}
                            disabled={{ before: today }}
                            contentClassName="w-auto p-0 z-[60] bg-brand-brown-dark border-white/15 shadow-2xl"
                            calendarClassName="bg-brand-brown-dark text-white border-none"
                            calendarClassNames={calendarClassNames}
                            trigger={<div className="bg-white/10 rounded-sm px-4 py-2 flex items-center gap-3 min-w-max border border-white/5 relative group cursor-pointer focus-within:ring-1 focus-within:ring-brand-gold">
                                    <Calendar className="w-4 h-4 text-brand-gold" />
                                    <div className="flex flex-col relative w-24 sm:w-28">
                                        <span className="text-[10px] text-white/60 font-semibold uppercase tracking-wider mb-0.5">Check-in</span>
                                        <span className="bg-transparent text-sm text-white font-bold outline-none cursor-pointer w-full appearance-none">
                                            {checkIn ? format(checkIn, "dd/MM/yy") : "Selecione"}
                                        </span>
                                    </div>
                                </div>}
                        />

                        {/* Check-out */}
                        <DateField
                            value={checkOut}
                            openMonth={checkIn ?? checkOut}
                            onSelect={(date) => {
                                setCheckOut(date);
                                setError("");
                                if (date) setIsCheckOutOpen(false);
                            }}
                            open={isCheckOutOpen}
                            onOpenChange={setIsCheckOutOpen}
                            disabled={{ before: addDays(checkIn || today, 1) }}
                            contentClassName="w-auto p-0 z-[60] bg-brand-brown-dark border-white/15 shadow-2xl"
                            calendarClassName="bg-brand-brown-dark text-white border-none"
                            calendarClassNames={calendarClassNames}
                            trigger={<div className="bg-white/10 rounded-sm px-4 py-2 flex items-center gap-3 min-w-max border border-white/5 relative group cursor-pointer focus-within:ring-1 focus-within:ring-brand-gold">
                                    <Calendar className="w-4 h-4 text-brand-gold" />
                                    <div className="flex flex-col relative w-24 sm:w-28">
                                        <span className="text-[10px] text-white/60 font-semibold uppercase tracking-wider mb-0.5">Check-out</span>
                                        <span className="bg-transparent text-sm text-white font-bold outline-none cursor-pointer w-full appearance-none">
                                            {checkOut ? format(checkOut, "dd/MM/yy") : "Selecione"}
                                        </span>
                                    </div>
                                </div>}
                        />

                        <div className="hidden md:block w-px h-10 bg-white/10 mx-2"></div>

                        {/* Hóspedes (Adultos & Crianças) */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <div aria-label={`Hóspedes: ${guestsLabel}`} role="button" className="bg-white/10 rounded-sm px-4 py-2 flex items-center gap-3 min-w-max border border-white/5 relative group cursor-pointer focus-within:ring-1 focus-within:ring-brand-gold">
                                    <Users className="w-4 h-4 text-brand-gold" />
                                    <div className="flex flex-col relative min-w-[70px] sm:min-w-[100px]">
                                        <span className="text-[10px] text-white/60 font-semibold uppercase tracking-wider mb-0.5">Hóspedes</span>
                                        <span className="bg-transparent text-sm text-white font-bold outline-none cursor-pointer w-full appearance-none whitespace-nowrap">
                                            {guestsLabel}
                                        </span>
                                    </div>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="max-h-[80vh] w-[300px] overflow-y-auto p-6 z-[60] bg-brand-brown-dark border-white/15 shadow-2xl sm:w-[340px]" align="end">
                                <GuestsPanel
                                    tone="dark"
                                    value={guests}
                                    onChange={(next) => {
                                        setGuests(next);
                                        setError("");
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Submit Button */}
                    <Link
                        href="/reservar"
                        onClick={handleSimulate('booking_assistant_desktop')}
                        className="w-full md:w-auto mt-2 md:mt-0 flex-shrink-0 bg-brand-gold hover:opacity-90 transition-colors text-brand-brown-dark font-sans tracking-[0.15em] px-6 py-3.5 rounded-sm flex items-center justify-center gap-2 font-bold text-xs tracking-widest uppercase cursor-pointer"
                    >
                        SIMULAR RESERVA <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
