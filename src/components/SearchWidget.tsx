'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar as CalendarIcon, Users, Search, ChevronDown, Loader2, Plus, Minus } from 'lucide-react';
import { format, addDays, isBefore, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { trackClickWhatsApp, trackSearch } from '@/lib/analytics';

const RESERVA_INTERACTION_EVENT = 'reservar-cta-interaction';

function deferStateUpdate(callback: () => void) {
    queueMicrotask(callback);
}

interface SearchWidgetProps {
    variant?: 'default' | 'light';
    uiPreset?: 'default' | 'inline' | 'hero';
    ctaMicrocopy?: string;
    submitLabel?: string;
    submitLabelMobile?: string;
    onPrimaryCtaClick?: () => void;
    prefillFromQuery?: boolean;
    collapsible?: boolean;
}

export default function SearchWidget({
    variant = 'default',
    uiPreset = 'default',
    ctaMicrocopy,
    submitLabel = 'Buscar',
    submitLabelMobile,
    onPrimaryCtaClick,
    prefillFromQuery = false,
    collapsible = false,
}: SearchWidgetProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const promoLocked = searchParams.get('promoLock') === '1';

    // Definir datas padrão (hoje e amanhã)
    const today = new Date();
    const tomorrow = addDays(today, 1);

    const [checkIn, setCheckIn] = useState<Date | undefined>(today);
    const [checkOut, setCheckOut] = useState<Date | undefined>(tomorrow);
    const [adults, setAdults] = useState('2');
    const [children, setChildren] = useState('0');
    const [childrenAges, setChildrenAges] = useState<(number | null)[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [couponFeedback, setCouponFeedback] = useState('');
    const [couponFeedbackType, setCouponFeedbackType] = useState<'success' | 'warning' | ''>('');
    const [isHeroExpanded, setIsHeroExpanded] = useState(false);

    const maxGuests = 4;
    const numAdults = Number.parseInt(adults, 10) || 0;
    const numChildren = Number.parseInt(children, 10) || 0;
    const totalGuests = numAdults + numChildren;
    const maxChildren = Math.max(0, maxGuests - numAdults);
    const isOverCapacity = totalGuests > maxGuests;
    const [showCapacityFallback, setShowCapacityFallback] = useState(false);

    // Controlar abertura dos popovers
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
    const [isGuestsOpen, setIsGuestsOpen] = useState(false);
    const [checkOutViewMonth, setCheckOutViewMonth] = useState<Date>(checkOut || tomorrow);

    // Fechar popovers ao mudar de rota (previne estado travado após Back navigation)
    useEffect(() => {
        deferStateUpdate(() => {
            setIsCheckInOpen(false);
            setIsCheckOutOpen(false);
            setIsGuestsOpen(false);
        });
    }, [pathname]);

    // Anti-bfcache (restauração do browser com estado antigo)
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                setIsCheckInOpen(false);
                setIsCheckOutOpen(false);
                setIsGuestsOpen(false);
            }
        };
        window.addEventListener("pageshow", handlePageShow);
        return () => window.removeEventListener("pageshow", handlePageShow);
    }, []);

    const handleCheckInSelect = (date: Date | undefined) => {
        setCheckIn(date);
        setIsCheckInOpen(false); // Fecha o calendário após selecionar

        // Automatizar Check-out
        if (date) {
            setCheckOutViewMonth(date);
            // Se check-out não estiver definido, ou for antes/igual ao check-in
            if (!checkOut || isBefore(checkOut, date) || isSameDay(checkOut, date)) {
                setCheckOut(addDays(date, 1));
            }
        }
    };

    const handleCheckOutOpenChange = (open: boolean) => {
        setIsCheckOutOpen(open);
        if (open) {
            setCheckOutViewMonth(checkIn || checkOut || today);
        }
    };

    const handleCheckOutSelect = (date: Date | undefined) => {
        setCheckOut(date);
        setIsCheckOutOpen(false);
    };

    const handleWhatsAppClick = () => {
        const checkInStr = checkIn ? format(checkIn, 'dd/MM/yyyy') : 'DATA INDEFINIDA';
        const checkOutStr = checkOut ? format(checkOut, 'dd/MM/yyyy') : 'DATA INDEFINIDA';

        const message = `Olá! Gostaria de cotar hospedagem para *${adults} adultos* e *${children} crianças*.\n` +
            `Datas: ${checkInStr} a ${checkOutStr}.\n` +
            `(Nossas acomodações comportam até 4 pessoas por quarto, conforme disponibilidade. Para grupos maiores, fale com a gente no WhatsApp.)`;

        const whatsappPhone = '5519999654866';
        const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
        trackClickWhatsApp('search_widget_capacidade');
        window.open(url, '_blank');
    };

    const handleAdultsChange = (value: string) => {
        const parsed = Number.parseInt(value, 10);
        const nextAdults = Number.isFinite(parsed) ? parsed : 1;
        const normalizedAdults = Math.min(Math.max(nextAdults, 1), maxGuests);
        setAdults(String(normalizedAdults));
        const nextMaxChildren = Math.max(0, maxGuests - normalizedAdults);
        const nextChildren = numChildren > nextMaxChildren ? nextMaxChildren : numChildren;
        if (numChildren > nextMaxChildren) {
            setChildren(String(nextMaxChildren));
        }
        setChildrenAges((prev) => {
            const next = prev.slice(0, nextChildren);
            while (next.length < nextChildren) next.push(null);
            return next;
        });
        if (showCapacityFallback && normalizedAdults + nextChildren <= maxGuests) {
            setShowCapacityFallback(false);
        }
    };

    const handleChildrenChange = (value: string) => {
        const parsed = Number.parseInt(value, 10);
        const nextChildren = Number.isFinite(parsed) ? parsed : 0;
        const normalizedChildren = Math.min(Math.max(nextChildren, 0), maxChildren);
        setChildren(String(normalizedChildren));
        setChildrenAges((prev) => {
            const next = prev.slice(0, normalizedChildren);
            while (next.length < normalizedChildren) next.push(null);
            return next;
        });
        if (showCapacityFallback && numAdults + normalizedChildren <= maxGuests) {
            setShowCapacityFallback(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setSearchMessage('');
        setCouponFeedback('');
        setCouponFeedbackType('');
        trackSearch({
            checkIn: checkIn ? format(checkIn, 'yyyy-MM-dd') : undefined,
            checkOut: checkOut ? format(checkOut, 'yyyy-MM-dd') : undefined,
            adults,
            children,
        });

        if (numAdults < 1) {
            alert('Selecione ao menos 1 adulto.');
            return;
        }

        if (numChildren > 0) {
            if (childrenAges.length !== numChildren || childrenAges.some((age) => age === null)) {
                alert('Informe a idade de todas as crianças.');
                return;
            }
            if (childrenAges.some((age) => typeof age !== 'number' || !Number.isFinite(age) || age < 0 || age > 17)) {
                alert('Idade de criança inválida.');
                return;
            }
        }

        const normalizedChildrenAges = numChildren > 0
            ? childrenAges.map((age) => Number.parseInt(String(age ?? ''), 10)).filter((age) => Number.isFinite(age))
            : [];
        const adultsFromChildren = normalizedChildrenAges.filter((age) => age >= 12).length;
        const childrenUnder12 = normalizedChildrenAges.filter((age) => age < 12).length;
        const effectiveAdults = numAdults + adultsFromChildren;
        const effectiveTotalGuests = effectiveAdults + childrenUnder12;

        if (effectiveTotalGuests > maxGuests) {
            setShowCapacityFallback(true);
            return;
        }

        if (!checkIn || !checkOut) {
            alert('Por favor, selecione as datas de check-in e check-out.');
            return;
        }

        if (isSameDay(checkIn, checkOut) || isBefore(checkOut, checkIn)) {
            alert('A data de check-out deve ser posterior ao check-in.');
            return;
        }

        setShowCapacityFallback(false);
        setLoading(true);

        const params = new URLSearchParams({
            checkIn: format(checkIn, 'yyyy-MM-dd'),
            checkOut: format(checkOut, 'yyyy-MM-dd'),
            adults,
            children
        });
        if (normalizedChildrenAges.length > 0) {
            params.set('childrenAges', normalizedChildrenAges.map((a) => String(a)).join(','));
        }
        const normalizedCoupon = couponCode.trim().toUpperCase();
        if (normalizedCoupon) {
            params.set('promo', normalizedCoupon);
            if (promoLocked) {
                params.set('promoLock', '1');
            }
        }

        try {
            const response = await fetch(`/api/availability?${params.toString()}`, { cache: 'no-store' });
            const responsePromoApplied = response.headers.get('x-promo-applied') === 'true';
            const responsePromoMessage = response.headers.get('x-promo-message') || '';

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                if (errorBody?.error === 'min_stay_required') {
                    const nights = Number(errorBody.minLos || 1);
                    setSearchMessage(`Para esta data, o mínimo de reservas é ${nights} noite${nights > 1 ? 's' : ''}.`);
                    return;
                }
                const errorMessage = typeof errorBody?.error === 'string'
                    ? errorBody.error
                    : 'Erro ao buscar disponibilidade. Tente novamente.';
                setSearchMessage(errorMessage);
                return;
            }

            const data = await response.json();
            if (Array.isArray(data) && data.length === 0) {
                setSearchMessage('Sem disponibilidade para essas datas/ocupação.');
                return;
            }

            if (normalizedCoupon) {
                if (responsePromoApplied) {
                    setCouponFeedback(`Cupom ${normalizedCoupon} válido e aplicado.`);
                    setCouponFeedbackType('success');
                } else if (responsePromoMessage) {
                    setCouponFeedback(responsePromoMessage);
                    setCouponFeedbackType('warning');
                }
            }

            router.push(`/reservar?${params.toString()}`);
        } catch {
            setSearchMessage('Erro ao buscar disponibilidade. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const isInlinePreset = uiPreset === 'inline';
    const isHeroPreset = uiPreset === 'hero';
    const shouldShowHeroCompact = isHeroPreset && collapsible && !isHeroExpanded;
    const showCouponField = !isHeroPreset;
    const heroCalendarClassNames = isHeroPreset ? {
        months: 'flex flex-col space-y-4',
        month: 'space-y-4',
        caption: 'relative flex items-center justify-center border-b border-white/35 pb-4 pt-1',
        caption_label: 'font-accent text-base font-medium uppercase tracking-[0.18em] text-[#2f261f]',
        nav: 'flex items-center gap-2',
        nav_button: 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/45 bg-white/45 p-0 text-[#5a4631] opacity-100 backdrop-blur-sm transition-colors hover:bg-white/65 hover:text-[#2f261f]',
        nav_button_previous: 'absolute left-0',
        nav_button_next: 'absolute left-11',
        head_cell: 'w-full py-2 text-center font-accent text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-[#6b5845]',
        cell: 'relative h-11 w-full p-0 text-center text-sm [&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected].day-range-start)]:rounded-l-full [&:has([aria-selected])]:bg-white/35 first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20',
        day: 'mx-auto h-10 w-10 rounded-full p-0 font-medium text-[#3f3428] transition-colors hover:bg-white/55 hover:text-[#241c16]',
        day_selected: 'bg-[#e6d8c7] text-[#2f261f] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-[#ddcdb9] hover:text-[#2f261f] focus:bg-[#ddcdb9] focus:text-[#2f261f]',
        day_today: 'border border-[#b89467]/35 bg-white/45 text-[#6c5231]',
        day_outside: 'text-[#bca998] opacity-60 aria-selected:bg-white/35 aria-selected:text-[#8b755e]',
        day_disabled: 'text-[#c5b6a8] opacity-45',
        day_range_middle: 'aria-selected:bg-white/35 aria-selected:text-[#3f3428]',
    } satisfies CalendarProps['classNames'] : undefined;
    const heroSelectContentClass = 'rounded-[22px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,250,244,0.82),rgba(247,238,228,0.72))] p-2 text-[#3f3428] shadow-[0_24px_70px_rgba(7,6,4,0.3)] backdrop-blur-xl';
    const heroSelectItemClass = 'rounded-2xl py-3 pl-10 pr-4 font-accent text-sm font-medium uppercase tracking-[0.14em] text-[#5e4c39] focus:bg-white/55 focus:text-[#2a2119]';
    const heroBarClass = 'max-w-[1180px] rounded-[28px] bg-[#11100d] px-6 shadow-[0_22px_50px_rgba(15,12,8,0.18)]';
    const heroFieldClass = 'flex h-full items-center px-7';
    const heroFieldInnerClass = 'flex h-[58px] w-full flex-col justify-center gap-2';
    const heroGuestsInnerClass = 'flex h-[58px] w-full max-w-[172px] flex-col justify-center gap-2';
    const heroDividerClass = 'lg:border-r lg:border-[rgba(214,192,137,0.22)]';
    const heroLabelClass = 'flex items-center gap-2 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-[#8f8577]';
    const heroValueClass = 'flex h-auto w-full cursor-pointer items-center justify-between rounded-none border-0 bg-transparent px-0 py-0 text-left font-sans text-[0.98rem] font-semibold text-[#f8f3ea] transition-colors duration-300 hover:text-[#e4c48e]';
    const heroTriggerClass = 'h-auto w-full rounded-none border-0 bg-transparent px-0 font-sans text-[0.98rem] font-semibold text-[#f8f3ea] shadow-none ring-0 ring-offset-0 placeholder:text-[#8f8577] focus:ring-0 focus:ring-offset-0';
    const heroButtonColumnClass = 'flex h-full items-center px-7';
    const heroGuestsPanelClass = 'w-[340px] rounded-[24px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,250,244,0.92),rgba(247,238,228,0.88))] p-5 text-[#3f3428] shadow-[0_24px_70px_rgba(7,6,4,0.3)] backdrop-blur-xl';

    const labelClass = isInlinePreset
        ? 'mb-2 flex items-center gap-2 text-sm font-medium text-foreground'
        : isHeroPreset
            ? heroLabelClass
            : `mb-2 flex items-center gap-2 text-sm font-medium ${variant === 'light' ? 'text-primary' : 'text-white'}`;

    const dateInputClass = isInlinePreset
        ? 'w-full h-11 rounded-md border border-input bg-white px-3 text-sm text-foreground flex items-center justify-between transition-colors cursor-pointer'
        : isHeroPreset
            ? heroValueClass
            : 'w-full px-4 py-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground font-medium flex items-center justify-between transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px]';

    const selectClass = isInlinePreset
        ? 'w-full h-11 rounded-md border border-input bg-white px-3 text-sm text-foreground appearance-none'
        : isHeroPreset
            ? 'h-[52px] w-full appearance-none rounded-none border-0 bg-transparent px-0 font-sans text-[1rem] font-semibold text-white transition-colors duration-300 cursor-pointer'
            : 'w-full px-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground font-medium transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px] appearance-none';

    const adultOptions = [1, 2, 3, 4];
    const childOptions = [0, 1, 2, 3];
    const shouldShowCapacityFallback = showCapacityFallback || isOverCapacity;
    const agesMissing = numChildren > 0 && (childrenAges.length !== numChildren || childrenAges.some((age) => age === null));
    const searchDisabled = shouldShowCapacityFallback || numAdults < 1 || (numChildren > 0 && agesMissing) || !checkIn || !checkOut || loading;
    const searchMessageClass = variant === 'light'
        ? 'mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive'
        : 'mt-4 rounded-xl border border-white/40 bg-black/55 p-4 text-white shadow-lg backdrop-blur-sm';
    const loadingLabel = 'Buscando...';
    const mobileLabel = submitLabelMobile || submitLabel;
    const hasResponsiveLabel = Boolean(submitLabelMobile && submitLabelMobile !== submitLabel);
    const guestSummary = `${totalGuests} hóspede${totalGuests === 1 ? '' : 's'}`;
    const heroSummary = [
        checkIn ? format(checkIn, "dd MMM yyyy", { locale: ptBR }) : "Check-in",
        checkOut ? format(checkOut, "dd MMM yyyy", { locale: ptBR }) : "Check-out",
        guestSummary,
    ].join("  •  ");

    useEffect(() => {
        const incomingPromo = String(searchParams.get('promo') || searchParams.get('coupon') || '').trim().toUpperCase();
        deferStateUpdate(() => {
            if (incomingPromo) {
                setCouponCode(incomingPromo);
                return;
            }
            setCouponCode('');
        });
    }, [searchParams]);

    useEffect(() => {
        if (!prefillFromQuery) return;

        const checkInParam = searchParams.get('checkIn');
        const checkOutParam = searchParams.get('checkOut');
        const adultsParam = searchParams.get('adults');
        const childrenParam = searchParams.get('children');
        const childrenAgesParam = searchParams.get('childrenAges');

        const parseYmd = (value: string | null) => {
            if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
            const parsed = new Date(`${value}T00:00:00`);
            return Number.isNaN(parsed.getTime()) ? undefined : parsed;
        };

        const parsedCheckIn = parseYmd(checkInParam);
        const parsedCheckOut = parseYmd(checkOutParam);
        const parsedAdults = Number.parseInt(String(adultsParam || ''), 10);
        const parsedChildren = Number.parseInt(String(childrenParam || ''), 10);
        deferStateUpdate(() => {
            if (parsedCheckIn) setCheckIn(parsedCheckIn);
            if (parsedCheckOut) {
                setCheckOut(parsedCheckOut);
                setCheckOutViewMonth(parsedCheckOut);
            }

            if (Number.isFinite(parsedAdults)) {
                setAdults(String(Math.min(Math.max(parsedAdults, 1), maxGuests)));
            }

            if (Number.isFinite(parsedChildren)) {
                const normalizedChildren = Math.min(Math.max(parsedChildren, 0), 10);
                setChildren(String(normalizedChildren));

                const parsedAges = String(childrenAgesParam || '')
                    .split(',')
                    .map((item) => Number.parseInt(item.trim(), 10))
                    .filter((age) => Number.isFinite(age))
                    .slice(0, normalizedChildren)
                    .map((age) => Math.min(Math.max(age, 0), 17));

                const nextAges: Array<number | null> = [...parsedAges];
                while (nextAges.length < normalizedChildren) nextAges.push(null);
                setChildrenAges(nextAges);
            }
        });
    }, [prefillFromQuery, searchParams, maxGuests]);

    useEffect(() => {
        if (!isHeroPreset || !collapsible) return;

        const handleExpandRequest = () => {
            setIsHeroExpanded(true);
        };

        window.addEventListener(RESERVA_INTERACTION_EVENT, handleExpandRequest);
        return () => window.removeEventListener(RESERVA_INTERACTION_EVENT, handleExpandRequest);
    }, [collapsible, isHeroPreset]);



    return (
        <div className="w-full">
            {shouldShowHeroCompact ? (
                <button
                    type="button"
                    onClick={() => setIsHeroExpanded(true)}
                    className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-[#6c5736]/70 bg-[rgba(12,10,8,0.88)] px-4 py-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:border-[#8a7045] sm:px-5"
                >
                    <div className="min-w-0">
                        <p className="font-accent text-[0.6rem] font-medium uppercase tracking-[0.16em] text-white/52">
                            Buscar hospedagem
                        </p>
                        <p className="mt-1 truncate font-sans text-[0.9rem] font-semibold text-white sm:text-[0.92rem]">
                            {heroSummary}
                        </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-[#d8bb8e] bg-[#d1b07c] px-3 py-2 font-accent text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#241910] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                        Expandir
                    </span>
                </button>
            ) : null}
            {isHeroPreset && collapsible && isHeroExpanded ? (
                <div className="mb-2 flex justify-end">
                    <button
                        type="button"
                        onClick={() => setIsHeroExpanded(false)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-accent text-[0.62rem] font-medium uppercase tracking-[0.14em] text-[#e6d9bc] transition-colors hover:bg-white/[0.08]"
                    >
                        Minimizar busca
                    </button>
                </div>
            ) : null}
            {!shouldShowHeroCompact ? (
            <div className={cn(isHeroPreset && heroBarClass)}>
            <form onSubmit={handleSearch} className={cn(
                "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[repeat(16,minmax(0,1fr))] gap-4 items-end",
                isHeroPreset && "gap-y-4 lg:h-[96px] lg:grid-cols-[1fr_1fr_1.2fr_300px] lg:items-center lg:content-center lg:gap-x-0 lg:gap-y-0"
            )}>
                {/* Check-in */}
                <div className={cn("flex flex-col md:col-span-1 xl:col-span-3", isHeroPreset && `${heroFieldClass} ${heroDividerClass}`)}>
                    <div className={cn(isHeroPreset && heroFieldInnerClass)}>
                    <label className={labelClass}>
                        <CalendarIcon className="w-4 h-4" />
                        Check-in
                    </label>
                    <Popover open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
                    <PopoverTrigger asChild>
                        <div data-testid="checkin-trigger" className={cn(dateInputClass, !checkIn && (isHeroPreset ? "text-white/45" : "text-muted-foreground"))}>
                            {checkIn ? (
                                isHeroPreset
                                    ? format(checkIn, "dd MMM yyyy", { locale: ptBR })
                                    : format(checkIn, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                                <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className={cn("ml-auto h-4 w-4 opacity-50", isHeroPreset && "text-[#8f8577]")} />
                        </div>
                    </PopoverTrigger>
                        <PopoverContent
                            data-testid="checkin-popover"
                            className="w-auto p-0 max-w-[90vw] max-h-[80vh] overflow-auto rounded-xl shadow-xl border border-border/60"
                            align="start"
                            collisionPadding={12}
                            sideOffset={8}
                        >
                            <Calendar
                                mode="single"
                                selected={checkIn}
                                onSelect={handleCheckInSelect}
                                disabled={(date) => isBefore(date, new Date()) && !isSameDay(date, new Date())}
                                initialFocus
                                locale={ptBR}
                                className={cn(isHeroPreset && 'rounded-[26px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,250,244,0.82),rgba(247,238,228,0.72))] p-5 shadow-[0_24px_70px_rgba(7,6,4,0.3)] backdrop-blur-xl')}
                                classNames={heroCalendarClassNames}
                            />
                        </PopoverContent>
                    </Popover>
                    </div>
                </div>

                {/* Check-out */}
                <div className={cn("flex flex-col md:col-span-1 xl:col-span-3", isHeroPreset && `${heroFieldClass} ${heroDividerClass}`)}>
                    <div className={cn(isHeroPreset && heroFieldInnerClass)}>
                    <label className={labelClass}>
                        <CalendarIcon className="w-4 h-4" />
                        Check-out
                    </label>
                    <Popover open={isCheckOutOpen} onOpenChange={handleCheckOutOpenChange}>
                    <PopoverTrigger asChild>
                        <div data-testid="checkout-trigger" className={cn(dateInputClass, !checkOut && (isHeroPreset ? "text-white/45" : "text-muted-foreground"))}>
                            {checkOut ? (
                                isHeroPreset
                                    ? format(checkOut, "dd MMM yyyy", { locale: ptBR })
                                    : format(checkOut, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                                <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className={cn("ml-auto h-4 w-4 opacity-50", isHeroPreset && "text-[#8f8577]")} />
                        </div>
                    </PopoverTrigger>
                        <PopoverContent
                            data-testid="checkout-popover"
                            className="w-auto p-0 max-w-[90vw] max-h-[80vh] overflow-auto rounded-xl shadow-xl border border-border/60"
                            align="start"
                            collisionPadding={12}
                            sideOffset={8}
                        >
                            <Calendar
                                mode="single"
                                selected={checkOut}
                                month={checkOutViewMonth}
                                onMonthChange={setCheckOutViewMonth}
                                onSelect={handleCheckOutSelect}
                                disabled={(date) =>
                                    (checkIn ? isBefore(date, checkIn) : isBefore(date, new Date()))
                                }
                                initialFocus
                                locale={ptBR}
                                className={cn(isHeroPreset && 'rounded-[26px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,250,244,0.82),rgba(247,238,228,0.72))] p-5 shadow-[0_24px_70px_rgba(7,6,4,0.3)] backdrop-blur-xl')}
                                classNames={heroCalendarClassNames}
                            />
                        </PopoverContent>
                    </Popover>
                    </div>
                </div>

                {/* Hóspedes / Adultos / Crianças */}
                <div className={cn("flex flex-col md:col-span-2 xl:col-span-4", isHeroPreset && `${heroFieldClass} ${heroDividerClass}`)}>
                    <div className={cn(isHeroPreset && heroGuestsInnerClass, !isHeroPreset && heroFieldInnerClass)}>
                    <label htmlFor="adults" className={labelClass}>
                        <Users className="w-4 h-4" />
                        Hóspedes
                    </label>
                    {isHeroPreset ? (
                        <Popover open={isGuestsOpen} onOpenChange={setIsGuestsOpen}>
                            <PopoverTrigger asChild>
                                <button type="button" className={cn(heroTriggerClass, "text-left")} aria-label={guestSummary}>
                                    <span className="flex w-full items-center justify-between pr-[2px] leading-none">
                                        <span>{guestSummary}</span>
                                        <ChevronDown className="h-4 w-4 text-[#8f8577]" />
                                    </span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                className={heroGuestsPanelClass}
                                align="start"
                                collisionPadding={12}
                                sideOffset={10}
                            >
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="font-accent text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#7a644d]">
                                            Configurar ocupação
                                        </p>
                                        <p className="text-sm text-[#6b5845]">
                                            Até 4 hóspedes por quarto. Crianças de 0 a 5 anos não pagam, mas contam na ocupação.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between rounded-[18px] border border-[#d9c3a2]/55 bg-white/55 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-semibold text-[#2a2119]">Adultos</p>
                                            <p className="text-xs text-[#7a644d]">A partir de 12 anos</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 rounded-full border-[#ccb089] bg-white/80 p-0 hover:bg-white"
                                                onClick={() => handleAdultsChange(String(Math.max(1, numAdults - 1)))}
                                                disabled={numAdults <= 1}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="inline-flex min-w-8 items-center justify-center text-base font-semibold text-[#2a2119]">
                                                {adults}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 rounded-full border-[#ccb089] bg-white/80 p-0 hover:bg-white"
                                                onClick={() => handleAdultsChange(String(Math.min(maxGuests, numAdults + 1)))}
                                                disabled={numAdults >= maxGuests}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-[18px] border border-[#d9c3a2]/55 bg-white/55 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-semibold text-[#2a2119]">Crianças</p>
                                            <p className="text-xs text-[#7a644d]">Até 11 anos</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 rounded-full border-[#ccb089] bg-white/80 p-0 hover:bg-white"
                                                onClick={() => handleChildrenChange(String(Math.max(0, numChildren - 1)))}
                                                disabled={numChildren <= 0}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="inline-flex min-w-8 items-center justify-center text-base font-semibold text-[#2a2119]">
                                                {children}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 rounded-full border-[#ccb089] bg-white/80 p-0 hover:bg-white"
                                                onClick={() => handleChildrenChange(String(Math.min(maxChildren, numChildren + 1)))}
                                                disabled={numChildren >= maxChildren}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {numChildren > 0 ? (
                                        <div className="space-y-2 rounded-[18px] border border-[#d9c3a2]/55 bg-white/55 p-4">
                                            <p className="text-sm font-semibold text-[#2a2119]">Idade das crianças</p>
                                            <p className="text-xs text-[#7a644d]">
                                                0 a 5 anos: cortesia. 6 a 11 anos: tarifa de criança. A partir de 12 anos: conta como adulto.
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {childrenAges.map((age, idx) => (
                                                    <Select
                                                        key={idx}
                                                        value={age === null ? "" : String(age)}
                                                        onValueChange={(value) => {
                                                            const nextAge = value === "" ? null : Number.parseInt(value, 10);
                                                            setChildrenAges((prev) => prev.map((v, i) => (i === idx ? nextAge : v)));
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-11 rounded-2xl border-[#d9c3a2]/70 bg-white/80 px-4 text-left text-sm font-medium text-[#3f3428]">
                                                            <SelectValue aria-label={age === null ? `Idade da criança ${idx + 1}` : `${age} anos`}>
                                                                {age === null ? `Criança ${idx + 1}` : `${age} anos`}
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent className={heroSelectContentClass} position="popper" sideOffset={12}>
                                                            {Array.from({ length: 18 }, (_, ageOpt) => (
                                                                <SelectItem key={ageOpt} value={String(ageOpt)} className={heroSelectItemClass}>
                                                                    {ageOpt} {ageOpt === 1 ? 'ano' : 'anos'}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </PopoverContent>
                        </Popover>
                    ) : (
                        <>
                            <div className="mb-4 relative">
                                <select
                                    id="adults"
                                    value={adults}
                                    onChange={(e) => handleAdultsChange(e.target.value)}
                                    className={selectClass}
                                >
                                    {adultOptions.map(num => (
                                        <option key={num} value={num}>{num}</option>
                                    ))}
                                </select>
                                <ChevronDown className={cn("pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50")} />
                            </div>
                            <div className="relative">
                                <select
                                    id="children"
                                    value={children}
                                    onChange={(e) => handleChildrenChange(e.target.value)}
                                    className={selectClass}
                                >
                                    {childOptions.map(num => (
                                        <option key={num} value={num} disabled={num > maxChildren}>{num}</option>
                                    ))}
                                </select>
                                <ChevronDown className={cn("pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50")} />
                            </div>
                        </>
                    )}
                    </div>
                </div>

                {/* Cupom */}
                {showCouponField ? (
                <div className="flex flex-col md:col-span-2 xl:col-span-3">
                    <label htmlFor="coupon" className={labelClass}>
                        Cupom
                    </label>
                    <input
                        id="coupon"
                        type="text"
                        className={cn(
                            dateInputClass,
                            isHeroPreset && "h-[58px] rounded-xl border border-white/12 bg-white/[0.03] px-5 py-0 text-[0.95rem] leading-none placeholder:font-sans placeholder:text-[0.95rem] placeholder:font-medium placeholder:tracking-normal placeholder:text-white/38 focus:border-[#d8bb8e]/40 focus:bg-white/[0.05] focus:outline-none focus:ring-0 caret-[#d8bb8e]"
                        )}
                        placeholder="Código Promocional"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={promoLocked}
                    />
                </div>
                ) : null}

                {/* Botão de busca */}
                <div className={cn("md:col-span-2 xl:col-span-3", isHeroPreset && `${heroButtonColumnClass} lg:col-span-1 lg:min-w-0`)}>
                    <Button
                        type="submit"
                        size={isHeroPreset ? "default" : "lg"}
                        className={isInlinePreset
                            ? 'w-full h-11 min-w-[170px] px-4 text-sm font-semibold flex items-center justify-center gap-2'
                            : isHeroPreset
                                ? 'flex h-[58px] w-full min-w-0 items-center justify-center gap-2 rounded-[16px] border border-[#d2a85e] bg-[#d1b07c] px-44 font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-[#241910] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-300 hover:bg-[#dbba86] hover:text-[#241910] hover:shadow-[0_10px_24px_rgba(209,176,124,0.2)] focus-visible:ring-[#f1d9b6] focus-visible:ring-offset-0'
                            : 'w-full min-w-[170px] h-[56px] px-5 text-sm md:text-base font-semibold flex items-center justify-center gap-2 bg-primary text-white border border-white/20 shadow-[0_10px_24px_rgba(15,23,42,0.35)] hover:brightness-110 hover:scale-[1.02] hover:shadow-[0_14px_28px_rgba(15,23,42,0.42)] transition-all duration-300 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary'}
                        aria-label={submitLabel}
                        onClick={() => {
                            onPrimaryCtaClick?.();
                        }}
                        disabled={searchDisabled}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Search className="h-4 w-4" />
                        )}
                        {isHeroPreset ? (
                            <span className="flex flex-col items-center justify-center leading-none">
                                <span className="whitespace-nowrap">{loading ? loadingLabel : submitLabel}</span>
                                <span className="mt-1 text-[0.5rem] tracking-[0.12em] text-[#5b4326]">
                                    Melhor tarifa
                                </span>
                            </span>
                        ) : hasResponsiveLabel ? (
                            <>
                                <span className="lg:hidden whitespace-nowrap">{loading ? loadingLabel : mobileLabel}</span>
                                <span className="hidden lg:inline whitespace-nowrap">{loading ? loadingLabel : submitLabel}</span>
                            </>
                        ) : (
                            <span className="whitespace-nowrap">{loading ? loadingLabel : submitLabel}</span>
                        )}
                    </Button>
                </div>
                {numChildren > 0 && !isHeroPreset ? (
                    <div className={cn("md:col-span-2 xl:col-span-15", isHeroPreset && "rounded-2xl border border-white/10 bg-white/[0.02] p-4 xl:pt-4")}>
                        <p className={cn("mb-2 text-xs text-white/90", isHeroPreset && "font-accent text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/58")}>
                            Informe a idade das crianças
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {childrenAges.map((age, idx) => (
                                <div key={idx} className="relative min-w-[140px] flex-1 md:flex-none md:basis-1/6">
                                    {isHeroPreset ? (
                                        <Select
                                            value={age === null ? "" : String(age)}
                                            onValueChange={(value) => {
                                                const nextAge = value === "" ? null : Number.parseInt(value, 10);
                                                setChildrenAges((prev) => prev.map((v, i) => (i === idx ? nextAge : v)));
                                            }}
                                        >
                                            <SelectTrigger className={cn(heroSelectTriggerClass, "rounded-xl border border-white/12 bg-white/[0.03] px-4 text-[0.98rem]")}>
                                                <SelectValue aria-label={age === null ? `Idade ${idx + 1}` : `${age} anos`}>
                                                    {age === null ? `Idade ${idx + 1}` : String(age)}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className={heroSelectContentClass} position="popper" sideOffset={12}>
                                                {Array.from({ length: 18 }, (_, ageOpt) => (
                                                    <SelectItem key={ageOpt} value={String(ageOpt)} className={heroSelectItemClass}>
                                                        {ageOpt} {ageOpt === 1 ? 'ano' : 'anos'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <>
                                            <select
                                                className={selectClass}
                                                value={age ?? ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const nextAge = val === "" ? null : Number.parseInt(val, 10);
                                                    setChildrenAges((prev) => prev.map((v, i) => (i === idx ? nextAge : v)));
                                                }}
                                            >
                                                <option value="" disabled>Idade</option>
                                                {Array.from({ length: 18 }, (_, ageOpt) => (
                                                    <option key={ageOpt} value={ageOpt}>{ageOpt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        {agesMissing ? (
                            <p
                                className={`mt-3 text-sm font-medium ${variant === 'light'
                                    ? 'text-destructive'
                                    : isHeroPreset
                                        ? 'inline-flex w-fit rounded-full border border-[#d8bb8e]/28 bg-[#d8bb8e]/10 px-3 py-1.5 font-accent text-[0.68rem] uppercase tracking-[0.14em] text-[#f0dfc4]'
                                        : 'inline-flex w-fit rounded-md border border-red-300/40 bg-red-500/20 px-2 py-1 text-red-100'}`}
                            >
                                Informe a idade para continuar
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </form>
            </div>
            ) : null}
            {ctaMicrocopy ? (
                <p className={cn(
                    "mt-3 text-sm font-medium text-center",
                    variant === 'light' ? 'text-primary' : 'text-white/95',
                    isHeroPreset && "mt-4 text-left text-xs font-medium tracking-[0.04em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]"
                )}>
                    {ctaMicrocopy}
                </p>
            ) : null}
            {couponFeedback ? (
                <div className={`mt-3 rounded-xl p-3 text-sm ${couponFeedbackType === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {couponFeedback}
                </div>
            ) : null}
            {promoLocked && couponCode ? (
                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                    Cupom promocional {couponCode} aplicado pela oferta especial.
                </div>
            ) : null}
            {searchMessage ? (
                <div className={searchMessageClass}>
                    <p className="text-sm font-medium">{searchMessage}</p>
                </div>
            ) : null}
            {shouldShowCapacityFallback ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                        <p className="text-sm font-medium">
                        Nossas acomodações comportam até 4 pessoas por quarto, conforme disponibilidade. Para grupos maiores, fale com a gente no WhatsApp.
                    </p>
                    <div className="mt-3">
                        <Button type="button" onClick={handleWhatsAppClick}>
                            Falar com a pousada no WhatsApp
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
