'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './reservas.module.css';

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
    payment: {
        status: string;
        amount: number;
    }[];
}

export default function AdminReservasPage() {
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    useEffect(() => {
        fetchBookings();
    }, [router]);

    const fetchBookings = async () => {
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
    };

    const filteredBookings = bookings.filter(b => {
        if (filter === 'ALL') return true;
        return b.status === filter;
    });

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            'PENDING': styles.statusPending,
            'CONFIRMED': styles.statusConfirmed,
            'CANCELLED': styles.statusCancelled,
        };
        return badges[status] || styles.statusPending;
    };

    const getStatusText = (status: string) => {
        const texts: Record<string, string> = {
            'PENDING': 'Pendente',
            'CONFIRMED': 'Confirmada',
            'CANCELLED': 'Cancelada',
        };
        return texts[status] || status;
    };

    if (loading) {
        return (
            <div className={styles.loading}>Carregando...</div>
        );
    }

    return (
        <>
            <div className={styles.pageHeader}>
                <h2>Todas as Reservas ({filteredBookings.length})</h2>

                <div className={styles.filters}>
                    <button
                        className={filter === 'ALL' ? styles.filterActive : styles.filter}
                        onClick={() => setFilter('ALL')}
                    >
                        Todas
                    </button>
                    <button
                        className={filter === 'PENDING' ? styles.filterActive : styles.filter}
                        onClick={() => setFilter('PENDING')}
                    >
                        Pendentes
                    </button>
                    <button
                        className={filter === 'CONFIRMED' ? styles.filterActive : styles.filter}
                        onClick={() => setFilter('CONFIRMED')}
                    >
                        Confirmadas
                    </button>
                    <button
                        className={filter === 'CANCELLED' ? styles.filterActive : styles.filter}
                        onClick={() => setFilter('CANCELLED')}
                    >
                        Canceladas
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
                                    <td>{new Date(booking.checkIn).toLocaleDateString('pt-BR')}</td>
                                    <td>{new Date(booking.checkOut).toLocaleDateString('pt-BR')}</td>
                                    <td>
                                        <strong>R$ {Number(booking.totalPrice).toFixed(2)}</strong>
                                    </td>
                                    <td>
                                        <span className={getStatusBadge(booking.status)}>
                                            {getStatusText(booking.status)}
                                        </span>
                                    </td>
                                    <td>{new Date(booking.createdAt).toLocaleDateString('pt-BR')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
