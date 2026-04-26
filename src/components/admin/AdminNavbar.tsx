'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import { 
    LayoutDashboard, 
    ClipboardList, 
    PlusCircle, 
    Home, 
    CalendarRange, 
    Ticket, 
    Globe, 
    LogOut 
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
    href: string;
    label: string;
    icon: React.ElementType;
};

export default function AdminNavbar() {
    const pathname = usePathname();
    const router = useRouter();

    if (pathname === '/admin/login') return null;

    const navItems: NavItem[] = [
        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
        { href: '/admin/reserva-manual', label: 'Reserva Manual', icon: PlusCircle },
        { href: '/admin/quartos', label: 'Quartos', icon: Home },
        { href: '/admin/mapa', label: 'Mapa de Tarifas', icon: CalendarRange },
        { href: '/admin/cupons', label: 'Cupons', icon: Ticket },
    ];

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    const handleLogout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => null);
        router.push('/admin/login');
    };

    return (
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shadow-sm">
            <div className="p-8">
                <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <span className="bg-slate-800 text-white p-1 rounded">DP</span>
                    Delplata
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                active 
                                    ? "bg-slate-800 text-white shadow-lg shadow-slate-200" 
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            )}
                        >
                            <Icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-400")} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100 space-y-1">
                <a 
                    href="/" 
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all" 
                    target="_blank" 
                    rel="noreferrer"
                >
                    <Globe className="h-5 w-5 text-slate-400" />
                    Ver Site
                </a>
                <button 
                    onClick={handleLogout} 
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
                >
                    <LogOut className="h-5 w-5" />
                    Sair
                </button>
            </div>
        </aside>
    );
}

