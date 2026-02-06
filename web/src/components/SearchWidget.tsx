'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Calendar as CalendarIcon, Users, Baby, Search, ChevronDown, Loader2 } from 'lucide-react';
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

interface SearchWidgetProps {
    variant?: 'default' | 'light';
}

export default function SearchWidget({ variant = 'default' }: SearchWidgetProps) {
    const router = useRouter();
    const pathname = usePathname();

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
            // Se check-out não estiver definido, ou for antes/igual ao check-in
            if (!checkOut || isBefore(checkOut, date) || isSameDay(checkOut, date)) {
                setCheckOut(addDays(date, 1));
            }
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

        try {
            const response = await fetch(`/api/availability?${params.toString()}`, { cache: 'no-store' });
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
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

            router.push(`/reservar?${params.toString()}`);
        } catch {
            setSearchMessage('Erro ao buscar disponibilidade. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const labelClass = `text-sm font-medium flex items-center gap-2 mb-2 ${variant === 'light' ? 'text-primary' : 'text-white'
        }`;

    const dateInputClass = "w-full px-4 py-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground font-medium flex items-center justify-between transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px]";

    const selectClass = "w-full px-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground font-medium transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px] appearance-none";

    const adultOptions = [1, 2, 3];
    const childOptions = [0, 1, 2];
    const shouldShowCapacityFallback = showCapacityFallback || isOverCapacity;
    const agesMissing = numChildren > 0 && (childrenAges.length !== numChildren || childrenAges.some((age) => age === null));
    const searchDisabled = shouldShowCapacityFallback || numAdults < 1 || (numChildren > 0 && agesMissing) || !checkIn || !checkOut || loading;

    useEffect(() => {
        if (numChildren > 0) firstAgeRef.current?.focus();
    }, [numChildren]);



    return (
        <div className="w-full">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Check-in */}
                <div className="flex flex-col md:col-span-3">
                    <label className={labelClass}>
                        <CalendarIcon className="w-4 h-4" />
                        Check-in
                    </label>
                    <Popover open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
                        <PopoverTrigger asChild>
                            <div className={cn(dateInputClass, !checkIn && "text-muted-foreground")}>
                                {checkIn ? (
                                    format(checkIn, "dd/MM/yyyy", { locale: ptBR })
                                ) : (
                                    <span>Selecione uma data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
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
                <div className="flex flex-col md:col-span-3">
                    <label className={labelClass}>
                        <CalendarIcon className="w-4 h-4" />
                        Check-out
                    </label>
                    <Popover open={isCheckOutOpen} onOpenChange={setIsCheckOutOpen}>
                        <PopoverTrigger asChild>
                            <div className={cn(dateInputClass, !checkOut && "text-muted-foreground")}>
                                {checkOut ? (
                                    format(checkOut, "dd/MM/yyyy", { locale: ptBR })
                                ) : (
                                    <span>Selecione uma data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={checkOut}
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
                <div className="flex flex-col md:col-span-2">
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
                <div className="flex flex-col md:col-span-2">
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

                {/* Botão de busca */}
                <div className="md:col-span-2">
                    <Button
                        type="submit"
                        size="lg"
                        className="w-full h-[56px] text-base font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 bg-primary hover:bg-primary/90 text-white"
                        disabled={searchDisabled}
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Search className="w-5 h-5" />
                        )}
                        <span className="whitespace-nowrap">{loading ? 'Buscando...' : 'Buscar'}</span>
                    </Button>
                </div>
                {numChildren > 0 ? (
                    <div className="md:col-span-12">
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
                            <p className="mt-1 text-xs text-destructive">Informe a idade para continuar</p>
                        ) : null}
                    </div>
                ) : null}
            </form>
            {searchMessage ? (
                <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
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
