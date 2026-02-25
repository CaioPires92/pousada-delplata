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

type BookingAction = 'test' | 'expire' | 'assist' | 'delete';

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
    const [actionBusy, setActionBusy] = useState<{ bookingId: string; action: BookingAction } | null>(null);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const testPaymentsEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_PAYMENTS === 'true';

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

    const runBookingAction = useCallback(async (params: {
        bookingId: string;
        action: BookingAction;
        endpoint: string;
        method?: 'POST' | 'DELETE';
        successMessage: string;
        payload?: Record<string, unknown>;
    }) => {
        setActionBusy({ bookingId: params.bookingId, action: params.action });
        setActionFeedback(null);

        try {
            const response = await fetch(params.endpoint, {
                method: params.method || 'POST',
                headers: params.payload ? { 'Content-Type': 'application/json' } : undefined,
                body: params.payload ? JSON.stringify(params.payload) : undefined,
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data?.message || data?.error || 'Nao foi possivel concluir a acao.');
            }

            setActionFeedback({ type: 'success', message: params.successMessage });
            await fetchBookings();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Nao foi possivel concluir a acao.';
            setActionFeedback({ type: 'error', message });
        } finally {
            setActionBusy(null);
        }
    }, [fetchBookings]);

    const approveTestPayment = useCallback(async (bookingId: string) => {
        if (!testPaymentsEnabled) return;

        const confirmed = window.confirm('Confirmar pagamento manual de teste para esta reserva?');
        if (!confirmed) return;

        await runBookingAction({
            bookingId,
            action: 'test',
            endpoint: '/api/admin/bookings/' + bookingId + '/approve-test',
            method: 'POST',
            successMessage: 'Reserva ' + bookingId.slice(0, 8) + ' confirmada como pagamento de teste.',
        });
    }, [runBookingAction, testPaymentsEnabled]);

    const markBookingExpired = useCallback(async (bookingId: string) => {
        const confirmed = window.confirm('Marcar esta reserva como expirada?');
        if (!confirmed) return;
        await runBookingAction({
            bookingId,
            action: 'expire',
            endpoint: '/api/admin/bookings/' + bookingId + '/expire',
            method: 'POST',
            successMessage: 'Reserva ' + bookingId.slice(0, 8) + ' marcada como expirada.',

        });
    }, [runBookingAction]);

    const sendAssistEmail = useCallback(async (bookingId: string) => {
        const confirmed = window.confirm('Enviar email de ajuda para este hóspede?');
        if (!confirmed) return;
        await runBookingAction({
            bookingId,
            action: 'assist',
            endpoint: '/api/admin/bookings/' + bookingId + '/assist-email',
            method: 'POST',
            successMessage: 'Email de ajuda enviado para a reserva ' + bookingId.slice(0, 8) + '.',

        });
    }, [runBookingAction]);

    const deleteBooking = useCallback(async (booking: Booking) => {
        const bookingId = booking.id;
        const firstConfirm = window.confirm('Excluir esta reserva? Esta ação não pode ser desfeita.');
        if (!firstConfirm) return;

        const approvedPayment = String(booking.payment?.status || '').toUpperCase() === 'APPROVED';
        const secondMessage = approvedPayment
            ? 'Tem certeza? Esta reserva possui pagamento aprovado e será excluída permanentemente.'
            : 'Tem certeza? Esta reserva será excluída permanentemente.';

        const secondConfirm = window.confirm(secondMessage);
        if (!secondConfirm) return;

        await runBookingAction({
            bookingId,
            action: 'delete',
            endpoint: '/api/admin/bookings/' + bookingId,
            method: 'DELETE',
            successMessage: 'Reserva ' + bookingId.slice(0, 8) + ' excluida com sucesso.',
            payload: {
                confirmDelete: true,
                confirmApprovedDelete: approvedPayment,
            },
        });
    }, [runBookingAction]);

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

            {testPaymentsEnabled ? (
                <div className={styles.testModeBanner}>
                    Modo de teste ativo: use "Aprovar teste" para confirmar pagamento e disparar evento no GA4.
                </div>
            ) : null}

            {actionFeedback ? (
                <div className={actionFeedback.type === 'success' ? styles.testFeedbackSuccess : styles.testFeedbackError}>
                    {actionFeedback.message}
                </div>
            ) : null}

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
                                <th>Ações</th>
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
                                    <td className={styles.testActionCell}>
                                        <div className={styles.actionsGroup}>
                                            <button
                                                type="button"
                                                className={styles.secondaryActionButton}
                                                onClick={() => markBookingExpired(booking.id)}
                                                disabled={Boolean(actionBusy)}
                                            >
                                                {actionBusy?.bookingId === booking.id && actionBusy?.action === 'expire' ? 'Processando...' : 'Expirar'}
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.secondaryActionButton}
                                                onClick={() => sendAssistEmail(booking.id)}
                                                disabled={Boolean(actionBusy)}
                                            >
                                                {actionBusy?.bookingId === booking.id && actionBusy?.action === 'assist' ? 'Processando...' : 'Enviar ajuda'}
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.dangerActionButton}
                                                onClick={() => deleteBooking(booking)}
                                                disabled={Boolean(actionBusy)}
                                            >
                                                {actionBusy?.bookingId === booking.id && actionBusy?.action === 'delete' ? 'Processando...' : 'Excluir'}
                                            </button>
                                            {testPaymentsEnabled ? (
                                                <button
                                                    type="button"
                                                    className={styles.testActionButton}
                                                    onClick={() => approveTestPayment(booking.id)}
                                                    disabled={
                                                        Boolean(actionBusy)
                                                        || (
                                                            String(booking.status || '').toUpperCase() === 'CONFIRMED'
                                                            && String(booking.payment?.status || '').toUpperCase() === 'APPROVED'
                                                        )
                                                    }
                                                >
                                                    {actionBusy?.bookingId === booking.id && actionBusy?.action === 'test'
                                                        ? 'Processando...'
                                                        : (
                                                                String(booking.status || '').toUpperCase() === 'CONFIRMED'
                                                                && String(booking.payment?.status || '').toUpperCase() === 'APPROVED'
                                                            )
                                                            ? 'Aprovada'
                                                            : 'Aprovar teste'}
                                                </button>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}


