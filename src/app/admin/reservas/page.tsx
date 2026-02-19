'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './reservas.module.css';
import { formatDateBR } from '@/lib/date';

interface Booking {
    id: string;
    adults: number;
    children: number;
    childrenAges?: string | null;
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
        cardBrand?: string | null;
        installments?: number | null;
        provider?: string;
    } | null;
}

const BRAND_ALIASES: Record<string, string> = {
    MASTERCARD: 'MASTER',
    AMERICAN_EXPRESS: 'AMEX',
};

function normalizeBrand(value?: string | null) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    const normalized = raw.replace(/[\s-]+/g, '_');
    return BRAND_ALIASES[normalized] || normalized;
}

const KNOWN_BRANDS = new Set([
    'VISA',
    'MASTER',
    'ELO',
    'AMEX',
    'HIPERCARD',
    'MAESTRO',
    'CABAL',
    'NARANJA',
]);

function formatPaymentType(method?: string | null) {
    const m = String(method || '').trim().toUpperCase();
    if (!m) return '-';
    if (KNOWN_BRANDS.has(normalizeBrand(m))) return 'Crédito';

    const labels: Record<string, string> = {
        PIX: 'Pix',
        CREDIT_CARD: 'Crédito',
        DEBIT_CARD: 'Débito',
        ACCOUNT_MONEY: 'Saldo MP',
    };

    return labels[m] || m.replace(/_/g, ' ');
}

function normalizeChildrenAges(childrenAges?: string | null) {
    const raw = String(childrenAges || '').trim();
    if (!raw) return [] as number[];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((age) => Number.parseInt(String(age), 10))
                .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
        }
    } catch {
        // fallback CSV
    }

    return raw
        .split(',')
        .map((age) => Number.parseInt(age.trim(), 10))
        .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
}

function getPaymentBrand(payment?: Booking['payment']) {
    const explicitBrand = normalizeBrand(payment?.cardBrand);
    if (explicitBrand) return explicitBrand;

    const method = normalizeBrand(payment?.method);
    if (KNOWN_BRANDS.has(method)) return method;
    return '';
}

function formatPaymentBrand(payment?: Booking['payment']) {
    const brand = getPaymentBrand(payment);
    if (!brand) return '-';

    const labels: Record<string, string> = {
        MASTER: 'Master',
        VISA: 'Visa',
        ELO: 'Elo',
        AMEX: 'Amex',
        HIPERCARD: 'Hipercard',
        MAESTRO: 'Maestro',
        CABAL: 'Cabal',
        NARANJA: 'Naranja',
    };

    return labels[brand] || brand;
}

function isCreditPayment(payment?: Booking['payment']) {
    const method = String(payment?.method || '').trim().toUpperCase();
    if (method === 'CREDIT_CARD') return true;
    if (Number(payment?.installments || 0) > 0) return true;
    return Boolean(getPaymentBrand(payment));
}

function formatInstallments(payment?: Booking['payment']) {
    if (!isCreditPayment(payment)) return '-';
    const installments = Number.parseInt(String(payment?.installments ?? ''), 10);
    if (!Number.isFinite(installments) || installments <= 0) return '-';
    return `${installments}x`;
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
                                <th>Hóspedes</th>
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
                                    <td>
                                        <div className={styles.guestInfo}>
                                            <strong className={styles.compactMain}>{Number(booking.adults || 0) + Number(booking.children || 0)} hosp.</strong>
                                            <small className={styles.compactSub}>{booking.adults}A / {booking.children}C</small>
                                            {booking.children > 0 ? (
                                                <small className={styles.compactSub}>
                                                    Idades: {(() => {
                                                        const ages = normalizeChildrenAges(booking.childrenAges);
                                                        return ages.length > 0 ? ages.join(', ') : '-';
                                                    })()}
                                                </small>
                                            ) : null}
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
                                            <strong className={styles.compactMain}>{formatPaymentType(booking.payment?.method)}</strong>
                                            <small className={styles.compactSub}>Parc.: {formatInstallments(booking.payment)}</small>
                                            <small className={styles.compactSub}>Band.: {formatPaymentBrand(booking.payment)}</small>
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
