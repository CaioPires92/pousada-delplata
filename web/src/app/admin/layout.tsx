'use client';

import { usePathname } from 'next/navigation';
import AdminNavbar from '@/components/admin/AdminNavbar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    if (pathname === '/admin/login') return <>{children}</>;

    return (
        <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
            <AdminNavbar />
            <main className="p-6 max-w-[1400px] mx-auto">{children}</main>
        </div>
    );
}
