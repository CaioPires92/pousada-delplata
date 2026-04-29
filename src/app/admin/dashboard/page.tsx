'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    LayoutDashboard, 
    Calendar, 
    Home, 
    CreditCard, 
    Clock, 
    CheckCircle2, 
    Globe, 
    ArrowRight,
    Loader2,
    TrendingUp,
    Users,
    ChevronRight,
    Activity
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import styles from './dashboard.module.css';

interface Stats {
    totalBookings: number;
    pendingBookings: number;
    confirmedBookings: number;
    totalRevenue: number;
}

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/stats');
            if (response.status === 401) {
                router.push('/admin/login');
                return;
            }
            if (!response.ok) throw new Error('Erro ao carregar estatísticas');

            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Erro:', error);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (loading) {
        return (
            <div className={styles.loading}>
                <Loader2 className="w-10 h-10 animate-spin text-slate-200" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Preparando Painel...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.main}>
                <header className={styles.titleSection}>
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Visão Geral em Tempo Real</span>
                    </div>
                    <h2>Dashboard Administrativo</h2>
                    <p>Acompanhe o desempenho das suas reservas e ocupação.</p>
                </header>

                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <div className={cn(styles.statIconContainer, "bg-slate-100 text-slate-900")}>
                                <Calendar className="w-6 h-6" />
                            </div>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className={styles.statInfo}>
                            <h3>Total de Reservas</h3>
                            <p className={styles.statNumber}>{stats?.totalBookings || 0}</p>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <div className={cn(styles.statIconContainer, "bg-amber-50 text-amber-600")}>
                                <Clock className="w-6 h-6" />
                            </div>
                        </div>
                        <div className={styles.statInfo}>
                            <h3>Pendentes</h3>
                            <p className={styles.statNumber}>{stats?.pendingBookings || 0}</p>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <div className={cn(styles.statIconContainer, "bg-emerald-50 text-emerald-600")}>
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                        </div>
                        <div className={styles.statInfo}>
                            <h3>Confirmadas</h3>
                            <p className={styles.statNumber}>{stats?.confirmedBookings || 0}</p>
                        </div>
                    </div>

                    <div className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <div className={cn(styles.statIconContainer, "bg-indigo-50 text-indigo-600")}>
                                <CreditCard className="w-6 h-6" />
                            </div>
                        </div>
                        <div className={styles.statInfo}>
                            <h3>Receita Total</h3>
                            <p className={styles.statNumber}>
                                <span className="text-lg font-bold text-slate-400 mr-1">R$</span>
                                {(stats?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className={styles.quickActions}>
                    <h3>
                        <LayoutDashboard className="w-6 h-6" />
                        Ações Rápidas
                    </h3>
                    <div className={styles.actionsGrid}>
                        <a href="/admin/reservas" className={styles.actionCard}>
                            <div className={styles.actionLabel}>
                                <div className={styles.actionIcon}>
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <span>Ver Todas as Reservas</span>
                            </div>
                            <ChevronRight className="w-5 h-5 opacity-50" />
                        </a>
                        <a href="/admin/quartos" className={styles.actionCard}>
                            <div className={styles.actionLabel}>
                                <div className={styles.actionIcon}>
                                    <Home className="w-5 h-5" />
                                </div>
                                <span>Gerenciar Quartos</span>
                            </div>
                            <ChevronRight className="w-5 h-5 opacity-50" />
                        </a>
                        <a href="/" target="_blank" rel="noreferrer" className={styles.actionCard}>
                            <div className={styles.actionLabel}>
                                <div className={styles.actionIcon}>
                                    <Globe className="w-5 h-5" />
                                </div>
                                <span>Visualizar Site</span>
                            </div>
                            <ArrowRight className="w-5 h-5 opacity-50" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
