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
    ChevronRight,
    KanbanSquare,
    MessageSquare,
    BarChart3,
    Bot,
    CreditCard,
    ListTodo
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
    href: string;
    label: string;
    icon: React.ElementType;
};

type NavSection = {
    label: string;
    items: NavItem[];
};

interface AdminNavbarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

export default function AdminNavbar({ isCollapsed = false, onToggle }: AdminNavbarProps) {
    const pathname = usePathname();
    const router = useRouter();

    if (pathname === '/admin/login') return null;

    const navSections: NavSection[] = [
        {
            label: 'Visão geral',
            items: [
                { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/admin/analytics', label: 'Relatórios', icon: BarChart3 },
            ],
        },
        {
            label: 'Operação',
            items: [
                { href: '/admin/mapa', label: 'Mapa de Tarifas', icon: CalendarRange },
                { href: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
                { href: '/admin/reserva-manual', label: 'Reserva Manual', icon: PlusCircle },
                { href: '/admin/quartos', label: 'Quartos', icon: Home },
            ],
        },
        {
            label: 'Financeiro',
            items: [
                { href: '/admin/settings/partial-payment', label: 'Pagamento Parcial', icon: CreditCard },
                { href: '/admin/cupons', label: 'Cupons', icon: Ticket },
            ],
        },
        {
            label: 'Atendimento e CRM',
            items: [
                { href: '/admin/inbox', label: 'Caixa de Entrada', icon: MessageSquare },
                { href: '/admin/pipeline', label: 'Kanban de Vendas', icon: KanbanSquare },
                { href: '/admin/settings/chatbot', label: 'Chatbot e IA', icon: Bot },
                { href: '/admin/automation-jobs', label: 'Fila de Automação', icon: ListTodo },
            ],
        },
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

            <nav className={cn("flex-1 overflow-y-auto pb-4", isCollapsed ? "space-y-3 px-2" : "space-y-5 px-4")}>
                {navSections.map((section) => (
                    <div key={section.label} className="space-y-1">
                        {!isCollapsed && (
                            <p className="px-4 pb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                {section.label}
                            </p>
                        )}
                        {section.items.map((item) => {
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
                    </div>
                ))}
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
