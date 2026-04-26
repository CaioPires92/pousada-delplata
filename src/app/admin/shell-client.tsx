'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AdminNavbar from '@/components/admin/AdminNavbar';

export default function AdminShellClient({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (pathname === '/admin/login') return <>{children}</>;

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            <AdminNavbar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
            <main className="flex-1 p-10 overflow-auto transition-all duration-300">{children}</main>
        </div>
    );
}
