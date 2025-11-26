'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, Baby, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SearchWidget() {
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

    return (
        <div className="w-full">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                {/* Check-in */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="checkIn" className="text-sm font-medium text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Check-in
                    </label>
                    <input
                        type="date"
                        id="checkIn"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-lg border-2 border-white/20 bg-white/90 text-primary font-medium focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                    />
                </div>

                {/* Check-out */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="checkOut" className="text-sm font-medium text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Check-out
                    </label>
                    <input
                        type="date"
                        id="checkOut"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-lg border-2 border-white/20 bg-white/90 text-primary font-medium focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                    />
                </div>

                {/* Adultos */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="adults" className="text-sm font-medium text-white flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Adultos
                    </label>
                    <select
                        id="adults"
                        value={adults}
                        onChange={(e) => setAdults(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border-2 border-white/20 bg-white/90 text-primary font-medium focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all cursor-pointer"
                    >
                        {[1, 2, 3, 4, 5, 6].map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>

                {/* Crianças */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="children" className="text-sm font-medium text-white flex items-center gap-2">
                        <Baby className="w-4 h-4" />
                        Crianças
                    </label>
                    <select
                        id="children"
                        value={children}
                        onChange={(e) => setChildren(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border-2 border-white/20 bg-white/90 text-primary font-medium focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all cursor-pointer"
                    >
                        {[0, 1, 2, 3, 4].map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>

                {/* Botão de busca */}
                <Button
                    type="submit"
                    size="lg"
                    variant="secondary"
                    className="w-full h-[52px] text-base font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                    <Search className="w-5 h-5" />
                    <span className="whitespace-nowrap">Buscar</span>
                </Button>
            </form>
        </div>
    );
}
