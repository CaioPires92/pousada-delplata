import type { Metadata } from 'next';
import AdminShellClient from './shell-client';

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <AdminShellClient>{children}</AdminShellClient>;
}
