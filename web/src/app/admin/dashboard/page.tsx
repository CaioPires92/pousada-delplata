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
    const [adminName, setAdminName] = useState('');

    useEffect(() => {
        // Verificar se está logado
        const token = localStorage.getItem('admin_token');
        const name = localStorage.getItem('admin_name');

        if (!token) {
            router.push('/admin/login');
            return;
        }

        setAdminName(name || 'Admin');
        fetchStats();
    }, [router]);

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/admin/stats');
            if (!response.ok) throw new Error('Erro ao carregar estatísticas');

            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Erro:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_name');
        router.push('/admin/login');
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Carregando...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1>🏨 Painel Administrativo</h1>
                    <div className={styles.userInfo}>
                        <span>Olá, {adminName}!</span>
                        <button onClick={handleLogout} className={styles.logoutButton}>
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            <nav className={styles.nav}>
                <a href="/admin/dashboard" className={styles.navItemActive}>
                    📊 Dashboard
                </a>
                <a href="/admin/reservas" className={styles.navItem}>
                    📋 Reservas
                </a>
                <a href="/admin/quartos" className={styles.navItem}>
                    🏠 Quartos
                </a>
                <a href="/admin/mapa" className={styles.navItem}>
                    📅 Mapa de Tarifas
                </a>
                <a href="/" className={styles.navItem} target="_blank">
                    🌐 Ver Site
                </a>
            </nav>

            <main className={styles.main}>
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
                        <a href="/" target="_blank" className={styles.actionCard}>
                            <span className={styles.actionIcon}>🌐</span>
                            <span>Visualizar Site</span>
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
}
