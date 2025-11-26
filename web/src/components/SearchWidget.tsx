'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, Baby, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchWidgetProps {
    variant?: 'default' | 'light';
}

export default function SearchWidget({ variant = 'default' }: SearchWidgetProps) {
    const router = useRouter();
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [adults, setAdults] = useState('2');
    const [children, setChildren] = useState('0');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkIn || !checkOut) {
            alert('Por favor, selecione as datas de check-in e check-out.');
            return;
        }

        const params = new URLSearchParams({
            checkIn,
            checkOut,
            adults,
            children
        });

        router.push(`/reservar?${params.toString()}`);
    };

    const labelClass = `text-sm font-medium flex items-center gap-2 mb-2 ${variant === 'light' ? 'text-primary' : 'text-white'
        }`;

    const inputClass = "w-full px-3 py-3 rounded-lg border-2 border-muted-foreground/20 bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";

    return (
        <div className="w-full">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Check-in */}
                <div className="flex flex-col md:col-span-3">
                    <label htmlFor="checkIn" className={labelClass}>
                        <Calendar className="w-4 h-4" />
                        Check-in
                    </label>
                    <input
                        type="date"
                        id="checkIn"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        required
                        className={inputClass}
                        style={{ minHeight: '50px' }}
                    />
                </div>

                {/* Check-out */}
                <div className="flex flex-col md:col-span-3">
                    <label htmlFor="checkOut" className={labelClass}>
                        <Calendar className="w-4 h-4" />
                        Check-out
                    </label>
                    <input
                        type="date"
                        id="checkOut"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        required
                        className={inputClass}
                        style={{ minHeight: '50px' }}
                    />
                </div>

                {/* Adultos */}
                <div className="flex flex-col md:col-span-2">
                    <label htmlFor="adults" className={labelClass}>
                        <Users className="w-4 h-4" />
                        Adultos
                    </label>
                    <select
                        id="adults"
                        value={adults}
                        onChange={(e) => setAdults(e.target.value)}
                        className={`${inputClass} cursor-pointer`}
                        style={{ minHeight: '50px' }}
                    >
                        {[1, 2, 3, 4, 5, 6].map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>

                {/* Crianças */}
                <div className="flex flex-col md:col-span-2">
                    <label htmlFor="children" className={labelClass}>
                        <Baby className="w-4 h-4" />
                        Crianças
                    </label>
                    <select
                        id="children"
                        value={children}
                        onChange={(e) => setChildren(e.target.value)}
                        className={`${inputClass} cursor-pointer`}
                        style={{ minHeight: '50px' }}
                    >
                        {[0, 1, 2, 3, 4].map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>

                {/* Botão de busca */}
                <div className="md:col-span-2">
                    <Button
                        type="submit"
                        size="lg"
                        className="w-full h-[50px] text-base font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                    >
                        <Search className="w-5 h-5" />
                        <span className="whitespace-nowrap">Buscar</span>
                    </Button>
                </div>
            </form>
        </div>
    );
}
