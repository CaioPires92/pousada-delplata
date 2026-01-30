'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

    useEffect(() => {
        fetchStats();
    }, [router]);

    const fetchStats = async () => {
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
    };

    if (loading) {
        return (
            <div className={styles.loading}>Carregando...</div>
        );
    }

    return (
        <>
            <h2>Visão Geral</h2>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}>📋</div>
                    <div className={styles.statInfo}>
                        <h3>Total de Reservas</h3>
                        <p className={styles.statNumber}>{stats?.totalBookings || 0}</p>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}>⏳</div>
                    <div className={styles.statInfo}>
                        <h3>Pendentes</h3>
                        <p className={styles.statNumber}>{stats?.pendingBookings || 0}</p>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}>✅</div>
                    <div className={styles.statInfo}>
                        <h3>Confirmadas</h3>
                        <p className={styles.statNumber}>{stats?.confirmedBookings || 0}</p>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}>💰</div>
                    <div className={styles.statInfo}>
                        <h3>Receita Total</h3>
                        <p className={styles.statNumber}>
                            R$ {(stats?.totalRevenue || 0).toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>

            <div className={styles.quickActions}>
                <h3>Ações Rápidas</h3>
                <div className={styles.actionsGrid}>
                    <a href="/admin/reservas" className={styles.actionCard}>
                        <span className={styles.actionIcon}>📋</span>
                        <span>Ver Todas as Reservas</span>
                    </a>
                    <a href="/admin/quartos" className={styles.actionCard}>
                        <span className={styles.actionIcon}>🏠</span>
                        <span>Gerenciar Quartos</span>
                    </a>
                    <a href="/" target="_blank" rel="noreferrer" className={styles.actionCard}>
                        <span className={styles.actionIcon}>🌐</span>
                        <span>Visualizar Site</span>
                    </a>
                </div>
            </div>
        </>
    );
}
