'use client';

import { usePathname } from 'next/navigation';
import AdminNavbar from '@/components/admin/AdminNavbar';

export default function AdminShellClient({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    if (pathname === '/admin/login') return <>{children}</>;

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            <AdminNavbar />
            <main className="flex-1 p-10 overflow-y-auto">{children}</main>
        </div>
    );
}
