'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from '@/app/admin/dashboard/dashboard.module.css';

type NavItem = {
    href: string;
    label: string;
};

export default function AdminNavbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [adminName] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('admin_name') || '';
    });

    if (pathname === '/admin/login') return null;

    const navItems: NavItem[] = [
        { href: '/admin/dashboard', label: '📊 Dashboard' },
        { href: '/admin/reservas', label: '📋 Reservas' },
        { href: '/admin/quartos', label: '🏠 Quartos' },
        { href: '/admin/mapa', label: '📅 Mapa de Tarifas' },
    ];

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_name');
        router.push('/admin/login');
    };

    return (
        <>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1>🏨 Painel Administrativo</h1>
                    <div className={styles.userInfo}>
                        <span>{adminName ? `Olá, ${adminName}!` : ''}</span>
                        <button onClick={handleLogout} className={styles.logoutButton}>
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            <nav className={styles.nav}>
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={isActive(item.href) ? styles.navItemActive : styles.navItem}
                    >
                        {item.label}
                    </Link>
                ))}
                <a href="/" className={styles.navItem} target="_blank" rel="noreferrer">
                    🌐 Ver Site
                </a>
            </nav>
        </>
    );
}
