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
    LogOut,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
    href: string;
    label: string;
    icon: React.ElementType;
};

interface AdminNavbarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

export default function AdminNavbar({ isCollapsed = false, onToggle }: AdminNavbarProps) {
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
        <aside className={cn(
            "bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shadow-sm transition-all duration-300",
            isCollapsed ? "w-20" : "w-72"
        )}>
            <div className={cn("p-6 flex items-center justify-between", isCollapsed && "flex-col-reverse gap-4 px-2")}>
                {!isCollapsed && (
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                        <span className="bg-slate-800 text-white p-1 rounded shrink-0">DP</span>
                        Delplata
                    </h1>
                )}
                {isCollapsed && (
                    <span className="bg-slate-800 text-white p-2 rounded-lg font-black">DP</span>
                )}
                
                <button 
                    onClick={onToggle}
                    className={cn(
                        "p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all",
                        isCollapsed ? "mt-4" : ""
                    )}
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <nav className={cn("flex-1 space-y-1", isCollapsed ? "px-2" : "px-4")}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center rounded-xl text-sm font-bold transition-all",
                                isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                                active 
                                    ? "bg-slate-800 text-white shadow-lg shadow-slate-200" 
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            )}
                        >
                            <Icon className={cn("h-5 w-5 shrink-0", active ? "text-white" : "text-slate-400")} />
                            {!isCollapsed && <span className="overflow-hidden whitespace-nowrap">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className={cn("p-4 border-t border-slate-100 space-y-1", isCollapsed && "px-2")}>
                <a 
                    href="/" 
                    title={isCollapsed ? "Ver Site" : undefined}
                    className={cn(
                        "flex items-center rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all",
                        isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                    )}
                    target="_blank" 
                    rel="noreferrer"
                >
                    <Globe className="h-5 w-5 text-slate-400 shrink-0" />
                    {!isCollapsed && <span>Ver Site</span>}
                </a>
                <button 
                    onClick={handleLogout} 
                    title={isCollapsed ? "Sair" : undefined}
                    className={cn(
                        "w-full flex items-center rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all",
                        isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                    )}
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span>Sair</span>}
                </button>
            </div>
        </aside>
    );
}

