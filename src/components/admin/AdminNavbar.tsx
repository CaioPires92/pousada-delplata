'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from '@/app/admin/dashboard/dashboard.module.css';

type NavItem = {
    href: string;
    label: string;
};

export default function AdminNavbar() {
    const pathname = usePathname();
    const router = useRouter();

    if (pathname === '/admin/login') return null;

    const navItems: NavItem[] = [
        { href: '/admin/dashboard', label: '📊 Dashboard' },
        { href: '/admin/reservas', label: '📋 Reservas' },
        { href: '/admin/reserva-manual', label: '📝 Reserva Manual' },
        { href: '/admin/quartos', label: '🏠 Quartos' },
        { href: '/admin/mapa', label: '📅 Mapa de Tarifas' },
        { href: '/admin/cupons', label: '🎟️ Cupons' },
    ];

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    const handleLogout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => null);
        router.push('/admin/login');
    };

    return (
        <>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1>🏨 Painel Administrativo</h1>
                    <div className={styles.userInfo}>
                        <span />
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

