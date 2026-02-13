'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './reservas.module.css';
import { formatDateBR } from '@/lib/date';

interface Booking {
    id: string;
    checkIn: string;
    checkOut: string;
    totalPrice: number;
    status: string;
    createdAt: string;
    guest: {
        name: string;
        email: string;
        phone: string;
    };
    roomType: {
        name: string;
    };
    payment?: {
        status: string;
        amount: number;
        method?: string | null;
        provider?: string;
    } | null;
}

function formatPaymentMethod(method?: string | null) {
    const m = String(method || '').trim().toUpperCase();
    if (!m) return 'Não informado';

    const labels: Record<string, string> = {
        PIX: 'Pix',
        CREDIT_CARD: 'Cartão de crédito',
        DEBIT_CARD: 'Cartão de débito',
        ACCOUNT_MONEY: 'Saldo MP',
        MASTER: 'Master',
        VISA: 'Visa',
        ELO: 'Elo',
        AMEX: 'Amex',
        HIPERCARD: 'Hipercard',
    };

    return labels[m] || m.replace(/_/g, ' ');
}

export default function AdminReservasPage() {
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    const fetchBookings = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/bookings');
            if (response.status === 401) {
                router.push('/admin/login');
                return;
            }
            if (!response.ok) throw new Error('Erro ao carregar reservas');

            const data = await response.json();
            setBookings(data);
        } catch (error) {
            console.error('Erro:', error);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const filteredBookings = bookings.filter((b) => {
        if (filter === 'ALL') return true;
        return b.status === filter;
    });

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            PENDING: styles.statusPending,
            CONFIRMED: styles.statusConfirmed,
            CANCELLED: styles.statusCancelled,
            EXPIRED: styles.statusExpired,
            REFUNDED: styles.statusRefunded,
        };
        return badges[status] || styles.statusPending;
    };

    const getStatusText = (status: string) => {
        const texts: Record<string, string> = {
            PENDING: 'Pendente',
            CONFIRMED: 'Confirmada',
            CANCELLED: 'Cancelada',
            EXPIRED: 'Expirada',
            REFUNDED: 'Estornada',
        };
        return texts[status] || status;
    };

    if (loading) {
        return <div className={styles.loading}>Carregando...</div>;
    }

    return (
        <>
            <div className={styles.pageHeader}>
                <h2>Todas as Reservas ({filteredBookings.length})</h2>

                <div className={styles.filters}>
                    <button className={filter === 'ALL' ? styles.filterActive : styles.filter} onClick={() => setFilter('ALL')}>
                        Todas
                    </button>
                    <button className={filter === 'PENDING' ? styles.filterActive : styles.filter} onClick={() => setFilter('PENDING')}>
                        Pendentes
                    </button>
                    <button className={filter === 'CONFIRMED' ? styles.filterActive : styles.filter} onClick={() => setFilter('CONFIRMED')}>
                        Confirmadas
                    </button>
                    <button className={filter === 'CANCELLED' ? styles.filterActive : styles.filter} onClick={() => setFilter('CANCELLED')}>
                        Canceladas
                    </button>
                    <button className={filter === 'REFUNDED' ? styles.filterActive : styles.filter} onClick={() => setFilter('REFUNDED')}>
                        Estornadas
                    </button>
                    <button className={filter === 'EXPIRED' ? styles.filterActive : styles.filter} onClick={() => setFilter('EXPIRED')}>
                        Expiradas
                    </button>
                </div>
            </div>

            {filteredBookings.length === 0 ? (
                <div className={styles.empty}>
                    <p>Nenhuma reserva encontrada</p>
                </div>
            ) : (
                <div className={styles.table}>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Hóspede</th>
                                <th>Quarto</th>
                                <th>Check-in</th>
                                <th>Check-out</th>
                                <th>Valor</th>
                                <th>Pagamento</th>
                                <th>Status</th>
                                <th>Criada em</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBookings.map((booking) => (
                                <tr key={booking.id}>
                                    <td>
                                        <code>{booking.id.slice(0, 8)}</code>
                                    </td>
                                    <td>
                                        <div className={styles.guestInfo}>
                                            <strong>{booking.guest.name}</strong>
                                            <small>{booking.guest.email}</small>
                                            <small>{booking.guest.phone}</small>
                                        </div>
                                    </td>
                                    <td>{booking.roomType.name}</td>
                                    <td>{formatDateBR(booking.checkIn)}</td>
                                    <td>{formatDateBR(booking.checkOut)}</td>
                                    <td>
                                        <strong>R$ {Number(booking.totalPrice).toFixed(2)}</strong>
                                    </td>
                                    <td>
                                        <div className={styles.guestInfo}>
                                            <strong>{formatPaymentMethod(booking.payment?.method)}</strong>
                                            <small>{booking.payment?.status || 'Sem pagamento'}</small>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={getStatusBadge(booking.status)}>{getStatusText(booking.status)}</span>
                                    </td>
                                    <td>{formatDateBR(booking.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
