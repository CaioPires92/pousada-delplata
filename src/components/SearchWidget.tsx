'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar as CalendarIcon, Users, Search, ChevronDown, Loader2, Plus, Minus } from 'lucide-react';
import { format, addDays, isBefore, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar, type CalendarProps } from '@/components/ui/calendar';
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
import { trackBookingError, trackClickWhatsApp, trackSearch } from '@/lib/analytics';
import { appendCampaignAttribution } from '@/lib/campaign-attribution';

const RESERVA_INTERACTION_EVENT = 'reservar-cta-interaction';
const AVAILABILITY_TIMEOUT_MS = 12_000;

function deferStateUpdate(callback: () => void) {
    queueMicrotask(callback);
}

type SearchFieldErrors = {
    dates?: string;
    guests?: string;
    childrenAges?: string;
};

interface SearchWidgetProps {
    variant?: 'default' | 'light';
    uiPreset?: 'default' | 'inline' | 'hero';
    heroLayout?: 'stacked' | 'horizontal';
    hideCouponField?: boolean;
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
    heroLayout = 'stacked',
    hideCouponField = false,
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
    const preferredRoomTypeId = String(searchParams.get('roomTypeId') || '').trim();

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
    const [searchCanEscalate, setSearchCanEscalate] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [isCouponOpen, setIsCouponOpen] = useState(false);
    const [couponFeedback, setCouponFeedback] = useState('');
    const [couponFeedbackType, setCouponFeedbackType] = useState<'success' | 'warning' | ''>('');
    const [isHeroExpanded, setIsHeroExpanded] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<SearchFieldErrors>({});

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
        if (date && checkOut) {
            setFieldErrors((prev) => ({ ...prev, dates: undefined }));
        }
        setIsCheckInOpen(false); // Fecha o calendário após selecionar

        // Automatizar Check-out
        if (date) {
            const nextCheckOut = addDays(date, 1);
            setCheckOut(nextCheckOut);
            setCheckOutViewMonth(nextCheckOut);
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
        if (checkIn && date) {
            setFieldErrors((prev) => ({ ...prev, dates: undefined }));
        }
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
        setFieldErrors((prev) => ({ ...prev, guests: undefined, childrenAges: undefined }));
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
            while (next.length < nextChildren) next.push(0);
            return next;
        });
        if (showCapacityFallback && normalizedAdults + nextChildren <= maxGuests) {
            setShowCapacityFallback(false);
        }
    };

    const handleChildrenChange = (value: string) => {
        setFieldErrors((prev) => ({ ...prev, guests: undefined, childrenAges: undefined }));
        const parsed = Number.parseInt(value, 10);
        const nextChildren = Number.isFinite(parsed) ? parsed : 0;
        const normalizedChildren = Math.min(Math.max(nextChildren, 0), maxChildren);
        setChildren(String(normalizedChildren));
        setChildrenAges((prev) => {
            const next = prev.slice(0, normalizedChildren);
            while (next.length < normalizedChildren) next.push(0);
            return next;
        });
        if (showCapacityFallback && numAdults + normalizedChildren <= maxGuests) {
            setShowCapacityFallback(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setSearchMessage('');
        setSearchCanEscalate(false);
        setCouponFeedback('');
        setCouponFeedbackType('');
        setFieldErrors({});
        trackSearch({
            checkIn: checkIn ? format(checkIn, 'yyyy-MM-dd') : undefined,
            checkOut: checkOut ? format(checkOut, 'yyyy-MM-dd') : undefined,
            adults,
            children,
        });

        if (numAdults < 1) {
            setFieldErrors({ guests: 'Selecione ao menos 1 adulto para continuar.' });
            return;
        }

        if (numChildren > 0) {
            if (childrenAges.length !== numChildren || childrenAges.some((age) => age === null)) {
                setFieldErrors({ childrenAges: 'Informe a idade de todas as crianças para calcular a tarifa corretamente.' });
                return;
            }
            if (childrenAges.some((age) => typeof age !== 'number' || !Number.isFinite(age) || age < 0 || age > 17)) {
                setFieldErrors({ childrenAges: 'Revise as idades informadas. Aceitamos crianças de 0 a 17 anos.' });
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
            setFieldErrors({ guests: 'Cada acomodação recebe até 4 hóspedes. Se precisar de mais espaço, fale com a pousada para montar a melhor combinação.' });
            setShowCapacityFallback(true);
            return;
        }

        if (!checkIn || !checkOut) {
            setFieldErrors({ dates: 'Selecione check-in e check-out para ver a disponibilidade.' });
            return;
        }

        if (isSameDay(checkIn, checkOut) || isBefore(checkOut, checkIn)) {
            setFieldErrors({ dates: 'A saída deve ser pelo menos 1 dia após o check-in.' });
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
        if (preferredRoomTypeId) {
            params.set('roomTypeId', preferredRoomTypeId);
        }
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
        appendCampaignAttribution(params, searchParams);

        try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT_MS);
            let response: Response;
            try {
                response = await fetch(`/api/availability?${params.toString()}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
            } finally {
                window.clearTimeout(timeoutId);
            }
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
                setSearchCanEscalate(true);
                return;
            }

            const data = await response.json();
            if (Array.isArray(data) && data.length === 0) {
                setSearchMessage('Sem disponibilidade para essas datas/ocupação.');
                setSearchCanEscalate(true);
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
        } catch (error) {
            const timedOut = error instanceof DOMException && error.name === 'AbortError';
            const message = timedOut
                ? 'A consulta demorou mais que o esperado. Tente novamente ou fale conosco pelo WhatsApp.'
                : 'Erro ao buscar disponibilidade. Tente novamente.';
            setSearchMessage(message);
            setSearchCanEscalate(true);
            trackBookingError({ stage: 'search_availability', type: timedOut ? 'timeout' : 'network' });
        } finally {
            setLoading(false);
        }
    };

    const isInlinePreset = uiPreset === 'inline';
    const isHeroPreset = uiPreset === 'hero';
    const isHeroHorizontal = isHeroPreset && heroLayout === 'horizontal';
    const shouldShowHeroCompact = isHeroPreset && collapsible && !isHeroExpanded;
    const showCouponField = !hideCouponField;
    const heroCalendarClassNames = isHeroPreset ? {
        months: 'flex flex-col space-y-4',
        month: 'space-y-4',
        caption: 'relative flex items-center justify-center border-b border-[color:var(--line-dark)] pb-4 pt-1',
        caption_label: 'font-accent text-base font-medium uppercase tracking-[0.18em] text-[color:var(--brand-forest)]',
        nav: 'flex items-center gap-2',
        nav_button: 'inline-flex h-9 w-9 items-center justify-center rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-white)] p-0 text-[color:var(--brand-forest)] opacity-100 transition-colors hover:bg-[color:var(--brand-cream)] hover:text-[color:var(--brand-forest)]',
        nav_button_previous: 'absolute left-0',
        nav_button_next: 'absolute left-11',
        head_cell: 'w-full py-2 text-center font-accent text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-forest)]/75',
        cell: 'relative h-11 w-full p-0 text-center text-sm [&:has([aria-selected].day-range-end)]:rounded-none [&:has([aria-selected].day-range-start)]:rounded-none [&:has([aria-selected])]:bg-white/35 first:[&:has([aria-selected])]:rounded-none last:[&:has([aria-selected])]:rounded-none focus-within:relative focus-within:z-20',
        day: 'mx-auto h-10 w-10 rounded-none p-0 font-medium text-[color:var(--brand-forest)] transition-colors hover:bg-[color:var(--brand-cream)] hover:text-[color:var(--brand-forest)]',
        day_selected: 'bg-[color:var(--brand-gold)]/28 text-[color:var(--brand-forest)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:bg-[color:var(--brand-gold)]/38 hover:text-[color:var(--brand-forest)] focus:bg-[color:var(--brand-gold)]/38 focus:text-[color:var(--brand-forest)]',
        day_today: 'border border-[color:var(--brand-gold)]/35 bg-[color:var(--brand-white)] text-[color:var(--brand-forest)]',
        day_outside: 'text-[#bca998] opacity-60 aria-selected:bg-white/35 aria-selected:text-[#8b755e]',
        day_disabled: 'text-[#c5b6a8] opacity-45',
        day_range_middle: 'aria-selected:bg-white/35 aria-selected:text-[#3f3428]',
    } satisfies CalendarProps['classNames'] : undefined;
    const heroSelectContentClass = 'rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] p-2 text-[color:var(--brand-forest)] shadow-[0_16px_34px_rgba(36,28,22,0.12)]';
    const heroSelectItemClass = 'rounded-none py-3 pl-10 pr-4 font-accent text-sm font-medium uppercase tracking-[0.14em] text-[color:var(--brand-forest)] focus:bg-[color:var(--brand-white)] focus:text-[color:var(--brand-forest)]';
    const heroBarClass = isHeroHorizontal
        ? 'w-full overflow-hidden bg-white shadow-[0_18px_44px_rgba(12,18,10,0.18)]'
        : 'w-full';
    const heroFieldClass = isHeroHorizontal ? 'flex h-full bg-white' : 'flex h-full';
    const heroFieldInnerClass = 'flex h-full w-full flex-col justify-center gap-2';
    const heroGuestsInnerClass = 'flex h-full w-full flex-col justify-center gap-2';
    const heroDividerClass = isHeroHorizontal
        ? 'border border-white/70 px-4 py-4 sm:px-5 sm:py-5 lg:min-h-[88px] lg:border-y-0 lg:border-l-0 lg:border-r lg:border-r-[color:var(--line-dark)]/35'
        : '';
    const heroLabelClass = cn(
        'flex items-center gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.14em]',
        isHeroHorizontal ? 'text-[color:var(--brand-forest)]/78' : 'text-white/80'
    );
    const heroValueClass = isHeroHorizontal
        ? 'flex h-auto min-h-7 w-full cursor-pointer items-center justify-between rounded-none border-0 bg-transparent p-0 text-left font-sans text-[1rem] font-semibold text-[color:var(--brand-forest)] shadow-none transition-colors duration-200 hover:text-[color:var(--brand-forest)]'
        : 'flex h-12 w-full cursor-pointer items-center justify-between rounded-none border border-white/46 bg-white/90 px-4 text-left font-sans text-[0.95rem] font-semibold text-[color:var(--brand-forest)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-colors duration-200 hover:border-[color:var(--brand-gold)] hover:bg-white';
    const heroTriggerClass = isHeroHorizontal
        ? 'flex h-auto min-h-7 w-full items-center rounded-none border-0 bg-transparent p-0 font-sans text-[1rem] font-semibold text-[color:var(--brand-forest)] shadow-none ring-0 ring-offset-0 placeholder:text-[color:var(--brand-forest)]/55 transition-colors duration-200 hover:text-[color:var(--brand-forest)] focus:ring-0 focus:ring-offset-0'
        : 'flex h-12 w-full items-center rounded-none border border-white/46 bg-white/90 px-4 font-sans text-[0.95rem] font-semibold text-[color:var(--brand-forest)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] ring-0 ring-offset-0 placeholder:text-[color:var(--brand-forest)]/55 transition-colors duration-200 hover:border-[color:var(--brand-gold)] hover:bg-white focus:ring-0 focus:ring-offset-0';
    const heroButtonColumnClass = isHeroHorizontal ? 'flex h-full items-stretch bg-white p-3 pt-1 sm:pt-3' : 'flex h-full items-end';
    const heroGuestsPanelClass = 'w-[340px] rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] p-5 text-[color:var(--brand-forest)] shadow-[0_16px_34px_rgba(36,28,22,0.12)]';

    const labelClass = isInlinePreset
        ? 'mb-2 flex items-center gap-2 text-sm font-medium text-foreground'
        : isHeroPreset
            ? heroLabelClass
            : `mb-2 flex items-center gap-2 text-sm font-medium ${variant === 'light' ? 'text-primary' : 'text-white'}`;

    const dateInputClass = isInlinePreset
        ? 'w-full h-11 rounded-none border border-input bg-white px-3 text-sm text-foreground flex items-center justify-between transition-colors cursor-pointer'
        : isHeroPreset
            ? heroValueClass
            : 'w-full px-4 py-4 rounded-none border-2 border-muted-foreground/20 bg-background text-foreground font-medium flex items-center justify-between transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px]';

    const selectClass = isInlinePreset
        ? 'w-full h-11 rounded-none border border-input bg-white px-3 text-sm text-foreground appearance-none'
        : isHeroPreset
            ? 'h-[52px] w-full appearance-none rounded-none border-0 bg-transparent px-0 font-sans text-[1rem] font-semibold text-[#2f261f] transition-colors duration-300 cursor-pointer'
            : 'w-full px-4 rounded-none border-2 border-muted-foreground/20 bg-background text-foreground font-medium transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px] appearance-none';

    const adultOptions = [1, 2, 3, 4];
    const childOptions = [0, 1, 2, 3];
    const shouldShowCapacityFallback = showCapacityFallback || isOverCapacity;
    const agesMissing = numChildren > 0 && (childrenAges.length !== numChildren || childrenAges.some((age) => age === null));
    const searchDisabled = shouldShowCapacityFallback || numAdults < 1 || (numChildren > 0 && agesMissing) || !checkIn || !checkOut || loading;
    const searchMessageClass = variant === 'light'
        ? 'mt-4 rounded-none border border-destructive/20 bg-destructive/10 p-4 text-destructive'
        : 'mt-4 rounded-none border border-[#d8cfbf] bg-[#f8f3ea] p-4 text-primary';
    const inlineErrorClass = isHeroPreset
        ? 'mt-3 rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900'
        : 'mt-2 rounded-none border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive';
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
                setIsCouponOpen(true);
                return;
            }
            setCouponCode('');
            setIsCouponOpen(false);
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
                    className="flex w-full items-center justify-between gap-3 rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] px-4 py-3 text-left shadow-[0_12px_28px_rgba(36,28,22,0.08)] transition-colors hover:border-[color:var(--brand-gold)]/45 sm:px-5"
                >
                    <div className="min-w-0">
                        <p className="font-accent text-[0.6rem] font-medium uppercase tracking-[0.16em] text-[color:var(--brand-forest)]/75">
                            Buscar hospedagem
                        </p>
                        <p className="mt-1 truncate font-sans text-[0.9rem] font-semibold text-[color:var(--brand-forest)] sm:text-[0.92rem]">
                            {heroSummary}
                        </p>
                    </div>
                    <span className="shrink-0 rounded-none border border-[color:var(--brand-gold)] bg-[color:var(--brand-gold)]/24 px-3 py-2 font-accent text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-forest)]">
                        Expandir
                    </span>
                </button>
            ) : null}
            {isHeroPreset && collapsible && isHeroExpanded ? (
                <div className="mb-2 flex justify-end">
                    <button
                        type="button"
                        onClick={() => setIsHeroExpanded(false)}
                        className="rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-white)] px-3 py-1.5 font-accent text-[0.62rem] font-medium uppercase tracking-[0.14em] text-[color:var(--brand-forest)] transition-colors hover:bg-[color:var(--brand-cream)]"
                    >
                        Minimizar busca
                    </button>
                </div>
            ) : null}
            {!shouldShowHeroCompact ? (
            <div className={cn(isHeroPreset && heroBarClass)}>
            <form onSubmit={handleSearch} className={cn(
                "grid grid-cols-1 gap-4 items-end md:grid-cols-2",
                isHeroPreset
                    ? isHeroHorizontal
                        ? "gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_280px] lg:items-stretch lg:gap-0"
                        : "gap-3 md:grid-cols-2 lg:grid-cols-1"
                    : "xl:grid-cols-[repeat(16,minmax(0,1fr))]"
            )}>
                {/* Check-in */}
                <div className={cn("flex flex-col md:col-span-1", isHeroPreset ? `${heroFieldClass} ${heroDividerClass} lg:col-span-1 xl:col-span-1` : "xl:col-span-3")}>
                    <div className={cn(isHeroPreset && heroFieldInnerClass)}>
                    <label className={labelClass}>
                        <CalendarIcon className="w-4 h-4" />
                        Check-in
                    </label>
                    <Popover open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
                    <PopoverTrigger asChild>
                        <div data-testid="checkin-trigger" className={cn(dateInputClass, !checkIn && (isHeroPreset ? "text-primary/65" : "text-muted-foreground"))}>
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
                            className="w-auto max-h-[80vh] max-w-[90vw] overflow-auto rounded-none border border-[color:var(--line-dark)] p-0 shadow-[0_16px_34px_rgba(36,28,22,0.12)]"
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
                                className={cn(isHeroPreset && 'rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] p-5 shadow-[0_16px_34px_rgba(36,28,22,0.12)]')}
                                classNames={heroCalendarClassNames}
                            />
                        </PopoverContent>
                    </Popover>
                    {fieldErrors.dates ? (
                        <p className={inlineErrorClass}>{fieldErrors.dates}</p>
                    ) : null}
                    </div>
                </div>

                {/* Check-out */}
                <div className={cn("flex flex-col md:col-span-1", isHeroPreset ? `${heroFieldClass} ${heroDividerClass} lg:col-span-1 xl:col-span-1` : "xl:col-span-3")}>
                    <div className={cn(isHeroPreset && heroFieldInnerClass)}>
                    <label className={labelClass}>
                        <CalendarIcon className="w-4 h-4" />
                        Check-out
                    </label>
                    <Popover open={isCheckOutOpen} onOpenChange={handleCheckOutOpenChange}>
                    <PopoverTrigger asChild>
                        <div data-testid="checkout-trigger" className={cn(dateInputClass, !checkOut && (isHeroPreset ? "text-primary/65" : "text-muted-foreground"))}>
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
                            className="w-auto max-h-[80vh] max-w-[90vw] overflow-auto rounded-none border border-[color:var(--line-dark)] p-0 shadow-[0_16px_34px_rgba(36,28,22,0.12)]"
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
                                    checkIn
                                        ? isBefore(date, checkIn) || isSameDay(date, checkIn)
                                        : isBefore(date, new Date())
                                }
                                initialFocus
                                locale={ptBR}
                                className={cn(isHeroPreset && 'rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-cream)] p-5 shadow-[0_16px_34px_rgba(36,28,22,0.12)]')}
                                classNames={heroCalendarClassNames}
                            />
                        </PopoverContent>
                    </Popover>
                    </div>
                </div>

                {/* Hóspedes / Adultos / Crianças */}
                <div className={cn("flex flex-col md:col-span-2", isHeroPreset ? `${heroFieldClass} ${heroDividerClass} lg:col-span-1 xl:col-span-1 ${isHeroHorizontal ? "md:col-span-2 lg:col-span-1" : ""}` : "xl:col-span-4")}>
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
                                        <p className="font-accent text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-forest)]/70">
                                            Configurar ocupação
                                        </p>
                                        <p className="text-sm text-[color:var(--brand-forest)]/75">
                                            Até 4 hóspedes por quarto. Crianças de 0 a 5 anos não pagam, mas contam na ocupação.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-white)]/70 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-semibold text-[color:var(--brand-forest)]">Adultos</p>
                                            <p className="text-xs text-[color:var(--brand-forest)]/70">A partir de 12 anos</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 rounded-none border-[color:var(--brand-gold)]/60 bg-[color:var(--brand-white)] p-0 hover:bg-[color:var(--brand-cream)]"
                                                onClick={() => handleAdultsChange(String(Math.max(1, numAdults - 1)))}
                                                disabled={numAdults <= 1}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="inline-flex min-w-8 items-center justify-center text-base font-semibold text-[color:var(--brand-forest)]">
                                                {adults}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 rounded-none border-[color:var(--brand-gold)]/60 bg-[color:var(--brand-white)] p-0 hover:bg-[color:var(--brand-cream)]"
                                                onClick={() => handleAdultsChange(String(Math.min(maxGuests, numAdults + 1)))}
                                                disabled={numAdults >= maxGuests}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-white)]/70 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-semibold text-[color:var(--brand-forest)]">Crianças</p>
                                            <p className="text-xs text-[color:var(--brand-forest)]/70">Até 11 anos</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 rounded-none border-[color:var(--brand-gold)]/60 bg-[color:var(--brand-white)] p-0 hover:bg-[color:var(--brand-cream)]"
                                                onClick={() => handleChildrenChange(String(Math.max(0, numChildren - 1)))}
                                                disabled={numChildren <= 0}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="inline-flex min-w-8 items-center justify-center text-base font-semibold text-[color:var(--brand-forest)]">
                                                {children}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 rounded-none border-[color:var(--brand-gold)]/60 bg-[color:var(--brand-white)] p-0 hover:bg-[color:var(--brand-cream)]"
                                                onClick={() => handleChildrenChange(String(Math.min(maxChildren, numChildren + 1)))}
                                                disabled={numChildren >= maxChildren}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {numChildren > 0 ? (
                                        <div className="space-y-2 rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-white)]/70 p-4">
                                            <p className="text-sm font-semibold text-[color:var(--brand-forest)]">Idade das crianças</p>
                                            <p className="text-xs text-[color:var(--brand-forest)]/70">
                                                0 a 5 anos: cortesia. 6 a 11 anos: tarifa de criança. A partir de 12 anos: conta como adulto.
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {childrenAges.map((age, idx) => (
                                                    <Select
                                                        key={idx}
                                                        value={age === null ? "" : String(age)}
                                                        onValueChange={(value) => {
                                                            const nextAge = value === "" ? null : Number.parseInt(value, 10);
                                                            setFieldErrors((prev) => ({ ...prev, childrenAges: undefined }));
                                                            setChildrenAges((prev) => prev.map((v, i) => (i === idx ? nextAge : v)));
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-11 rounded-none border-[color:var(--brand-gold)]/55 bg-[color:var(--brand-white)] px-4 text-left text-sm font-medium text-[color:var(--brand-forest)]">
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
                                    aria-label="Adultos"
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
                                    aria-label="Crianças"
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
                    {fieldErrors.guests ? (
                        <p className={inlineErrorClass}>{fieldErrors.guests}</p>
                    ) : null}
                    {fieldErrors.childrenAges ? (
                        <p className={inlineErrorClass}>{fieldErrors.childrenAges}</p>
                    ) : null}
                    </div>
                </div>

                {/* Botão de busca */}
                <div className={cn("md:col-span-2", isHeroPreset ? `${heroButtonColumnClass} lg:col-span-1 lg:min-w-0 xl:col-span-1` : "xl:col-span-4")}>
                    <Button
                        type="submit"
                        size={isHeroPreset ? "default" : "lg"}
                        className={isInlinePreset
                            ? 'w-full h-11 min-w-[170px] px-4 text-sm font-semibold flex items-center justify-center gap-2'
                            : isHeroPreset
                                ? cn(
                                    'flex w-full items-center justify-center gap-2 rounded-none px-5 font-sans text-[0.78rem] font-semibold uppercase tracking-[0.13em] shadow-none transition-all duration-200 focus-visible:ring-secondary focus-visible:ring-offset-0',
                                    isHeroHorizontal
                                        ? 'h-full min-h-[64px] border border-[#c5a06a] bg-[#D1B07C] text-[color:var(--brand-forest)] hover:bg-[#c9a66f] hover:shadow-[0_10px_24px_rgba(40,50,35,0.12)]'
                                        : 'h-[52px] border border-white/16 bg-[color:var(--brand-forest)] text-white hover:bg-[color:var(--forest-soft)] hover:shadow-[0_10px_24px_rgba(40,50,35,0.12)]'
                                )
                            : 'flex h-[56px] w-full min-w-[170px] items-center justify-center gap-2 border border-primary bg-primary px-5 text-sm font-semibold text-white shadow-none transition-all duration-300 hover:-translate-y-px hover:bg-primary/90 hover:shadow-[0_10px_24px_rgba(40,50,35,0.12)] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary md:text-base'}
                        aria-label={submitLabel}
                        onClick={() => {
                            onPrimaryCtaClick?.();
                        }}
                        disabled={searchDisabled}
                    >
                        {loading && !isHeroPreset ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : !isHeroPreset ? (
                            <Search className="h-4 w-4" />
                        ) : null}
                        {isHeroPreset ? (
                            <span className="flex flex-col items-center justify-center text-center leading-none">
                                <span className="whitespace-nowrap">{loading ? loadingLabel : 'Ver disponibilidade'}</span>
                                <span className={cn(
                                    "mt-1 text-[0.58rem] tracking-[0.14em]",
                                    isHeroHorizontal ? "text-[color:var(--brand-forest)]/68" : "text-white/72"
                                )}>
                                    {isHeroHorizontal ? 'Melhor tarifa' : 'Consulte valores'}
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
                {showCouponField ? (
                    <div className={cn(
                        "md:col-span-2 xl:col-span-full",
                        isHeroPreset
                            ? "border-t border-[color:var(--line-dark)] bg-[color:var(--brand-white)] px-5 py-3"
                            : "pt-1"
                    )}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[color:var(--brand-forest)]">
                                <input
                                    type="checkbox"
                                    aria-label="Adicionar cupom à busca"
                                    checked={isCouponOpen}
                                    disabled={promoLocked}
                                    onChange={(event) => {
                                        const nextOpen = event.target.checked;
                                        setIsCouponOpen(nextOpen);
                                        if (!nextOpen) {
                                            setCouponCode('');
                                            setCouponFeedback('');
                                            setCouponFeedbackType('');
                                        }
                                    }}
                                    className="h-4 w-4 accent-[color:var(--brand-forest)]"
                                />
                                Tenho um cupom de desconto
                            </label>
                            {isCouponOpen ? (
                                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-lg sm:flex-row">
                                    <input
                                        type="text"
                                        aria-label="Código do cupom"
                                        className={cn(
                                            dateInputClass,
                                            "h-11 min-w-0 flex-1 rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-white)] px-4 py-0 text-sm uppercase text-[color:var(--brand-forest)] placeholder:normal-case placeholder:text-[color:var(--brand-forest)]/55 focus:border-[color:var(--brand-gold)] focus:outline-none focus:ring-0"
                                        )}
                                        placeholder="Digite o código do cupom"
                                        value={couponCode}
                                        onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                                        disabled={promoLocked}
                                    />
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        disabled={loading || !couponCode.trim()}
                                        className="h-11 shrink-0 rounded-none border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-5 font-semibold text-[color:var(--brand-forest)] hover:bg-[color:var(--brand-gold)]/20"
                                    >
                                        {loading ? 'Aplicando...' : 'Aplicar cupom'}
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                {numChildren > 0 && !isHeroPreset ? (
                    <div className={cn("md:col-span-2 xl:col-span-15", isHeroPreset && "rounded-none border border-white/10 bg-white/[0.02] p-4 xl:pt-4")}>
                        <p className={cn("mb-2 text-xs text-white/90", isHeroPreset && "font-accent text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/58")}>
                            Informe a idade das crianças
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {childrenAges.map((age, idx) => (
                                <div key={idx} className="relative min-w-[140px] flex-1 md:flex-none md:basis-1/6">
                                    <>
                                        <select
                                            aria-label={`Idade da criança ${idx + 1}`}
                                            className={selectClass}
                                            value={age ?? ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const nextAge = val === "" ? null : Number.parseInt(val, 10);
                                                setFieldErrors((prev) => ({ ...prev, childrenAges: undefined }));
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
                                </div>
                            ))}
                        </div>
                        {agesMissing ? (
                            <p
                                className={`mt-3 text-sm font-medium ${variant === 'light'
                                    ? 'text-destructive'
                                    : isHeroPreset
                                        ? 'inline-flex w-fit rounded-none border border-[#d8bb8e]/28 bg-[#d8bb8e]/10 px-3 py-1.5 font-accent text-[0.68rem] uppercase tracking-[0.14em] text-[#f0dfc4]'
                                        : 'inline-flex w-fit rounded-none border border-red-300/40 bg-red-500/20 px-2 py-1 text-red-100'}`}
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
                    isHeroPreset && "mt-4 text-left text-xs font-medium tracking-[0.04em] text-primary/85"
                )}>
                    {ctaMicrocopy}
                </p>
            ) : null}
            {couponFeedback && pathname !== '/reservar' ? (
                <div className={`mt-3 rounded-none p-3 text-sm ${couponFeedbackType === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {couponFeedback}
                </div>
            ) : null}
            {promoLocked && couponCode ? (
                <div className="mt-3 rounded-none border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                    Cupom promocional {couponCode} aplicado pela oferta especial.
                </div>
            ) : null}
            {searchMessage ? (
                <div className={searchMessageClass}>
                    <p className="text-sm font-medium">{searchMessage}</p>
                    {searchCanEscalate ? (
                        <Button type="button" variant="outline" className="mt-3 rounded-none" onClick={handleWhatsAppClick}>
                            Falar com a pousada no WhatsApp
                        </Button>
                    ) : null}
                </div>
            ) : null}
            {shouldShowCapacityFallback ? (
                <div className="mt-4 rounded-none border border-amber-200 bg-amber-50 p-4 text-amber-900">
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
