'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar as CalendarIcon, Users, Baby, Search, ChevronDown, Loader2, Bookmark } from 'lucide-react';
import { format, addDays, isBefore, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { trackClickWhatsApp, trackSearch } from '@/lib/analytics';

interface SearchWidgetProps {
    variant?: 'default' | 'light';
    uiPreset?: 'default' | 'inline';
    ctaMicrocopy?: string;
    submitLabel?: string;
    submitLabelMobile?: string;
    onPrimaryCtaClick?: () => void;
    prefillFromQuery?: boolean;
}

export default function SearchWidget({
    variant = 'default',
    uiPreset = 'default',
    ctaMicrocopy,
    submitLabel = 'Buscar',
    submitLabelMobile,
    onPrimaryCtaClick,
    prefillFromQuery = false,
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

    const maxGuests = 3;
    const numAdults = Number.parseInt(adults, 10) || 0;
    const numChildren = Number.parseInt(children, 10) || 0;
    const totalGuests = numAdults + numChildren;
    const maxChildren = Math.max(0, maxGuests - numAdults);
    const isOverCapacity = totalGuests > maxGuests;
    const [showCapacityFallback, setShowCapacityFallback] = useState(false);

    // Controlar abertura dos popovers
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
    const [checkOutViewMonth, setCheckOutViewMonth] = useState<Date>(checkOut || tomorrow);
    const firstAgeRef = useRef<HTMLSelectElement | null>(null);

    // Fechar popovers ao mudar de rota (previne estado travado após Back navigation)
    useEffect(() => {
        setIsCheckInOpen(false);
        setIsCheckOutOpen(false);
    }, [pathname]);

    // Anti-bfcache (restauração do browser com estado antigo)
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                setIsCheckInOpen(false);
                setIsCheckOutOpen(false);
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
            `(Nossas acomodações comportam até 3 pessoas por quarto. Para grupos maiores, fale com a gente no WhatsApp.)`;

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

    const labelClass = uiPreset === 'inline'
        ? 'text-sm font-medium flex items-center gap-2 mb-2 text-foreground'
        : `text-sm font-medium flex items-center gap-2 mb-2 ${variant === 'light' ? 'text-primary' : 'text-white'}`;

    const dateInputClass = uiPreset === 'inline'
        ? 'w-full h-11 rounded-md border border-input bg-white px-3 text-sm text-foreground flex items-center justify-between transition-colors cursor-pointer'
        : 'w-full px-4 py-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground font-medium flex items-center justify-between transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px]';

    const selectClass = uiPreset === 'inline'
        ? 'w-full h-11 rounded-md border border-input bg-white px-3 text-sm text-foreground appearance-none'
        : 'w-full px-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground font-medium transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px] appearance-none';

    const adultOptions = [1, 2, 3];
    const childOptions = [0, 1, 2];
    const shouldShowCapacityFallback = showCapacityFallback || isOverCapacity;
    const agesMissing = numChildren > 0 && (childrenAges.length !== numChildren || childrenAges.some((age) => age === null));
    const searchDisabled = shouldShowCapacityFallback || numAdults < 1 || (numChildren > 0 && agesMissing) || !checkIn || !checkOut || loading;
    const searchMessageClass = variant === 'light'
        ? 'mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive'
        : 'mt-4 rounded-xl border border-white/40 bg-black/55 p-4 text-white shadow-lg backdrop-blur-sm';
    const loadingLabel = 'Buscando...';
    const mobileLabel = submitLabelMobile || submitLabel;
    const hasResponsiveLabel = Boolean(submitLabelMobile && submitLabelMobile !== submitLabel);

    useEffect(() => {
        if (numChildren > 0) firstAgeRef.current?.focus();
    }, [numChildren]);

    useEffect(() => {
        const incomingPromo = String(searchParams.get('promo') || searchParams.get('coupon') || '').trim().toUpperCase();
        if (incomingPromo) {
            setCouponCode(incomingPromo);
            return;
        }
        setCouponCode('');
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
        if (parsedCheckIn) setCheckIn(parsedCheckIn);
        if (parsedCheckOut) {
            setCheckOut(parsedCheckOut);
            setCheckOutViewMonth(parsedCheckOut);
        }

        const parsedAdults = Number.parseInt(String(adultsParam || ''), 10);
        if (Number.isFinite(parsedAdults)) {
            setAdults(String(Math.min(Math.max(parsedAdults, 1), maxGuests)));
        }

        const parsedChildren = Number.parseInt(String(childrenParam || ''), 10);
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
    }, [prefillFromQuery, searchParams, maxGuests]);



    return (
        <div className="w-full">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[repeat(16,minmax(0,1fr))] gap-4 items-end">
                {/* Check-in */}
                <div className="flex flex-col md:col-span-1 xl:col-span-3">
                    <label className={labelClass}>
                        <CalendarIcon className="w-4 h-4" />
                        Check-in
                    </label>
                    <Popover open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
                    <PopoverTrigger asChild>
                        <div data-testid="checkin-trigger" className={cn(dateInputClass, !checkIn && "text-muted-foreground")}>
                                {checkIn ? (
                                    format(checkIn, "dd/MM/yyyy", { locale: ptBR })
                                ) : (
                                    <span>Selecione uma data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Check-out */}
                <div className="flex flex-col md:col-span-1 xl:col-span-3">
                    <label className={labelClass}>
                        <CalendarIcon className="w-4 h-4" />
                        Check-out
                    </label>
                    <Popover open={isCheckOutOpen} onOpenChange={handleCheckOutOpenChange}>
                    <PopoverTrigger asChild>
                        <div data-testid="checkout-trigger" className={cn(dateInputClass, !checkOut && "text-muted-foreground")}>
                                {checkOut ? (
                                    format(checkOut, "dd/MM/yyyy", { locale: ptBR })
                                ) : (
                                    <span>Selecione uma data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Adultos */}
                <div className="flex flex-col md:col-span-1 xl:col-span-2">
                    <label htmlFor="adults" className={labelClass}>
                        <Users className="w-4 h-4" />
                        Adultos
                    </label>
                    <div className="relative">
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
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                    </div>
                </div>

                {/* Crianças */}
                <div className="flex flex-col md:col-span-1 xl:col-span-2">
                    <label htmlFor="children" className={labelClass}>
                        <Baby className="w-4 h-4" />
                        Crianças
                    </label>
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
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                    </div>
                    {/* Ages UI moved below the main form */}
                </div>

                {/* Cupom */}
                <div className="flex flex-col md:col-span-2 xl:col-span-3">
                    <label htmlFor="coupon" className={labelClass}>
                        <Bookmark className="w-4 h-4" />
                        Cupom
                    </label>
                    <input
                        id="coupon"
                        type="text"
                        className={dateInputClass}
                        placeholder="Código Promocional"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        disabled={promoLocked}
                    />
                </div>

                {/* Botão de busca */}
                <div className="md:col-span-2 xl:col-span-3">
                    <Button
                        type="submit"
                        size="lg"
                        className={uiPreset === 'inline'
                            ? 'w-full h-11 min-w-[170px] px-4 text-sm font-semibold flex items-center justify-center gap-2'
                            : 'w-full min-w-[170px] h-[56px] px-5 text-sm md:text-base font-semibold flex items-center justify-center gap-2 bg-primary text-white border border-white/20 shadow-[0_10px_24px_rgba(15,23,42,0.35)] hover:brightness-110 hover:scale-[1.02] hover:shadow-[0_14px_28px_rgba(15,23,42,0.42)] transition-all duration-300 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary'}
                        aria-label={submitLabel}
                        onClick={() => {
                            onPrimaryCtaClick?.();
                        }}
                        disabled={searchDisabled}
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Search className="w-5 h-5" />
                        )}
                        {hasResponsiveLabel ? (
                            <>
                                <span className="lg:hidden whitespace-nowrap">{loading ? loadingLabel : mobileLabel}</span>
                                <span className="hidden lg:inline whitespace-nowrap">{loading ? loadingLabel : submitLabel}</span>
                            </>
                        ) : (
                            <span className="whitespace-nowrap">{loading ? loadingLabel : submitLabel}</span>
                        )}
                    </Button>
                </div>
                {numChildren > 0 ? (
                    <div className="md:col-span-2 xl:col-span-15">
                        <p className="text-xs text-white/90 mb-1">
                            Informe a idade das crianças
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {childrenAges.map((age, idx) => (
                                <div key={idx} className="relative min-w-[140px] flex-1 md:flex-none md:basis-1/6">
                                    <select
                                        ref={idx === 0 ? firstAgeRef : undefined}
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
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                                </div>
                            ))}
                        </div>
                        {agesMissing ? (
                            <p
                                className={`mt-2 text-sm font-medium ${variant === 'light'
                                    ? 'text-destructive'
                                    : 'inline-flex w-fit rounded-md border border-red-300/40 bg-red-500/20 px-2 py-1 text-red-100'}`}
                            >
                                Informe a idade para continuar
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </form>
            {ctaMicrocopy ? (
                <p className={`mt-3 text-sm font-medium text-center ${variant === 'light' ? 'text-primary' : 'text-white/95'}`}>
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
                        Nossas acomodações comportam até 3 pessoas por quarto. Para grupos maiores, fale com a gente no WhatsApp.
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
