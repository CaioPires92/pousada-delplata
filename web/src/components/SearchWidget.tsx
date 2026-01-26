'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, Users, Baby, Search, ChevronDown } from 'lucide-react';
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

    // Definir datas padrão (hoje e amanhã)
    const today = new Date();
    const tomorrow = addDays(today, 1);

    const [checkIn, setCheckIn] = useState<Date | undefined>(today);
    const [checkOut, setCheckOut] = useState<Date | undefined>(tomorrow);
    const [adults, setAdults] = useState('2');
    const [children, setChildren] = useState('0');
    
    // Controlar abertura dos popovers
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);

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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkIn || !checkOut) {
            alert('Por favor, selecione as datas de check-in e check-out.');
            return;
        }

        const params = new URLSearchParams({
            checkIn: format(checkIn, 'yyyy-MM-dd'),
            checkOut: format(checkOut, 'yyyy-MM-dd'),
            adults,
            children
        });

        router.push(`/reservar?${params.toString()}`);
    };

    const labelClass = `text-sm font-medium flex items-center gap-2 mb-2 ${variant === 'light' ? 'text-primary' : 'text-white'
        }`;

    const dateInputClass = "w-full px-4 py-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground font-medium flex items-center justify-between transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px]";
    
    const selectClass = "w-full px-4 rounded-xl border-2 border-muted-foreground/20 bg-background text-foreground font-medium transition-all duration-300 text-base shadow-sm hover:shadow-md cursor-pointer h-[56px] appearance-none";

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
                            onChange={(e) => setAdults(e.target.value)}
                            className={selectClass}
                        >
                            {[1, 2, 3, 4, 5, 6].map(num => (
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
                            onChange={(e) => setChildren(e.target.value)}
                            className={selectClass}
                        >
                            {[0, 1, 2, 3, 4].map(num => (
                                <option key={num} value={num}>{num}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                    </div>
                </div>

                {/* Botão de busca */}
                <div className="md:col-span-2">
                    <Button
                        type="submit"
                        size="lg"
                        className="w-full h-[56px] text-base font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 bg-primary hover:bg-primary/90 text-white"
                    >
                        <Search className="w-5 h-5" />
                        <span className="whitespace-nowrap">Buscar</span>
                    </Button>
                </div>
            </form>
        </div>
    );
}
