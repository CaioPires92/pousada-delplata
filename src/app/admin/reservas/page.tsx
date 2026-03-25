'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { gaEvent } from '@/lib/analytics';
import BookingRowCard from './booking-row-card';
import { getStatusText } from './booking-view';
import {
    buildBookingsQuery,
    buildPeriodRange,
    formatPeriodLabel,
    shiftAnchorDate,
    type PeriodMode,
} from './period';
import type { Booking, BookingAction } from './types';
import styles from './reservas.module.css';

type ActionModalState = {
    booking: Booking;
    action: BookingAction;
};

type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';

const ANALYTICS_TEST_MODE_KEY = 'admin_analytics_test_mode';

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
    { key: 'ALL', label: 'Todas' },
    { key: 'PENDING', label: 'Pendentes' },
    { key: 'CONFIRMED', label: 'Confirmadas' },
    { key: 'CANCELLED', label: 'Canceladas' },
    { key: 'REFUNDED', label: 'Estornadas' },
    { key: 'EXPIRED', label: 'Expiradas' },
];

const PERIOD_MODES: Array<{ key: PeriodMode; label: string }> = [
    { key: 'month', label: 'Mês' },
    { key: 'week', label: 'Semana' },
    { key: 'day', label: 'Dia' },
    { key: 'range', label: 'Intervalo' },
];

function toYmd(date: Date) {
    return date.toISOString().slice(0, 10);
}

function getActionLabel(action: BookingAction) {
    const labels: Record<BookingAction, string> = {
        confirm: 'Confirmar reserva',
        expire: 'Expirar reserva',
        assist: 'Enviar ajuda',
        delete: 'Excluir reserva',
        test: 'Aprovar pagamento de teste',
    };
    return labels[action];
}

function getActionDescription(action: BookingAction, booking: Booking) {
    if (action === 'delete') {
        if (String(booking.payment?.status || '').toUpperCase() === 'APPROVED') {
            return 'Esta reserva possui pagamento aprovado e será excluída permanentemente. Esta ação não pode ser desfeita.';
        }
        return 'A reserva será excluída permanentemente. Esta ação não pode ser desfeita.';
    }
    if (action === 'confirm') return 'A reserva será marcada como confirmada.';
    if (action === 'expire') return 'A reserva será marcada como expirada.';
    if (action === 'assist') return 'Será enviado um e-mail de ajuda ao hóspede.';
    return 'Pagamento de teste será aprovado para esta reserva.';
}

function getStatusBadge(status: string) {
    const normalized = String(status || '').toUpperCase();
    const badges: Record<string, string> = {
        PENDING: styles.statusPending,
        CONFIRMED: styles.statusConfirmed,
        CANCELLED: styles.statusCancelled,
        EXPIRED: styles.statusExpired,
        REFUNDED: styles.statusRefunded,
    };
    return badges[normalized] || styles.statusPending;
}

export default function AdminReservasPage() {
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<StatusFilter>('ALL');
    const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
    const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [analyticsTestMode, setAnalyticsTestMode] = useState(false);
    const [actionBusy, setActionBusy] = useState<{ bookingId: string; action: BookingAction } | null>(null);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
    const [actionSelectValue, setActionSelectValue] = useState<Record<string, string>>({});

    const testPaymentsEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_PAYMENTS === 'true';
    const periodRange = useMemo(
        () => buildPeriodRange({ mode: periodMode, anchorDate: periodAnchor, customFrom: rangeFrom, customTo: rangeTo }),
        [periodMode, periodAnchor, rangeFrom, rangeTo]
    );
    const periodLabel = useMemo(
        () => formatPeriodLabel(periodMode, periodAnchor, periodRange),
        [periodMode, periodAnchor, periodRange]
    );
    const isRangeInvalid = periodMode === 'range' && !periodRange && (rangeFrom.length > 0 || rangeTo.length > 0);

    const trackAdminEvent = useCallback((eventName: string, params: Record<string, string | number | boolean> = {}) => {
        const payload: Record<string, string | number | boolean> = {
            section: 'admin_reservas',
            ...params,
        };
        if (analyticsTestMode) {
            payload.test_mode = true;
            payload.debug_mode = true;
        }
        gaEvent(eventName, payload);
    }, [analyticsTestMode]);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const query = buildBookingsQuery({
                status: filter,
                mode: periodMode,
                anchorDate: periodAnchor,
                customFrom: rangeFrom,
                customTo: rangeTo,
                dateField: 'checkIn',
            });
            const endpoint = query ? `/api/admin/bookings?${query}` : '/api/admin/bookings';
            const response = await fetch(endpoint);

            if (response.status === 401) {
                router.push('/admin/login');
                return;
            }
            if (!response.ok) throw new Error('Erro ao carregar reservas');

            const data = await response.json();
            setBookings(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Erro:', error);
            setBookings([]);
        } finally {
            setLoading(false);
        }
    }, [filter, periodMode, periodAnchor, rangeFrom, rangeTo, router]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    useEffect(() => {
        try {
            const storedValue = localStorage.getItem(ANALYTICS_TEST_MODE_KEY);
            setAnalyticsTestMode(storedValue === 'true');
        } catch {
            setAnalyticsTestMode(false);
        }
    }, []);

    useEffect(() => {
        if (!actionModal) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setActionModal(null);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [actionModal]);

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
        trackAdminEvent('admin_booking_action_requested', {
            action: params.action,
            booking_id_short: params.bookingId.slice(0, 8).toUpperCase(),
        });

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
            trackAdminEvent('admin_booking_action_success', {
                action: params.action,
                booking_id_short: params.bookingId.slice(0, 8).toUpperCase(),
            });
            await fetchBookings();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Nao foi possivel concluir a acao.';
            setActionFeedback({ type: 'error', message });
            trackAdminEvent('admin_booking_action_error', {
                action: params.action,
                booking_id_short: params.bookingId.slice(0, 8).toUpperCase(),
            });
        } finally {
            setActionBusy(null);
        }
    }, [fetchBookings, trackAdminEvent]);

    const approveTestPayment = useCallback(async (bookingId: string) => {
        if (!testPaymentsEnabled) return;

        await runBookingAction({
            bookingId,
            action: 'test',
            endpoint: '/api/admin/bookings/' + bookingId + '/approve-test',
            method: 'POST',
            successMessage: 'Reserva ' + bookingId.slice(0, 8) + ' confirmada como pagamento de teste.',
        });
    }, [runBookingAction, testPaymentsEnabled]);

    const confirmBooking = useCallback(async (bookingId: string) => {
        await runBookingAction({
            bookingId,
            action: 'confirm',
            endpoint: '/api/admin/bookings/' + bookingId + '/confirm',
            method: 'POST',
            successMessage: 'Reserva ' + bookingId.slice(0, 8) + ' confirmada com sucesso.',
        });
    }, [runBookingAction]);

    const markBookingExpired = useCallback(async (bookingId: string) => {
        await runBookingAction({
            bookingId,
            action: 'expire',
            endpoint: '/api/admin/bookings/' + bookingId + '/expire',
            method: 'POST',
            successMessage: 'Reserva ' + bookingId.slice(0, 8) + ' marcada como expirada.',
        });
    }, [runBookingAction]);

    const sendAssistEmail = useCallback(async (bookingId: string) => {
        await runBookingAction({
            bookingId,
            action: 'assist',
            endpoint: '/api/admin/bookings/' + bookingId + '/assist-email',
            method: 'POST',
            successMessage: 'Email de ajuda enviado para a reserva ' + bookingId.slice(0, 8) + '.',
        });
    }, [runBookingAction]);

    const deleteBooking = useCallback(async (booking: Booking) => {
        const approvedPayment = String(booking.payment?.status || '').toUpperCase() === 'APPROVED';
        const bookingId = booking.id;

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

    const executeAction = useCallback(async (booking: Booking, action: BookingAction) => {
        if (action === 'confirm') {
            await confirmBooking(booking.id);
            return;
        }

        if (action === 'expire') {
            await markBookingExpired(booking.id);
            return;
        }

        if (action === 'assist') {
            await sendAssistEmail(booking.id);
            return;
        }

        if (action === 'delete') {
            await deleteBooking(booking);
            return;
        }

        if (action === 'test') {
            await approveTestPayment(booking.id);
        }
    }, [approveTestPayment, confirmBooking, deleteBooking, markBookingExpired, sendAssistEmail]);

    const confirmActionModal = useCallback(async () => {
        if (!actionModal) return;

        const { booking, action } = actionModal;
        setActionModal(null);
        await executeAction(booking, action);
    }, [actionModal, executeAction]);

    const onActionSelect = useCallback((booking: Booking, actionValue: string) => {
        setActionSelectValue((prev) => ({
            ...prev,
            [booking.id]: '',
        }));

        if (!actionValue) return;

        const action = actionValue as BookingAction;
        trackAdminEvent('admin_booking_action_selected', {
            action,
            booking_id_short: booking.id.slice(0, 8).toUpperCase(),
        });
        setActionModal({ booking, action });
    }, [trackAdminEvent]);

    const onToggleAnalyticsTestMode = useCallback((enabled: boolean) => {
        setAnalyticsTestMode(enabled);
        try {
            localStorage.setItem(ANALYTICS_TEST_MODE_KEY, String(enabled));
        } catch {
            // no-op
        }
        gaEvent('admin_analytics_test_mode_toggled', {
            section: 'admin_reservas',
            enabled,
            ...(enabled ? { test_mode: true, debug_mode: true } : {}),
        });
    }, []);

    const onChangeStatus = useCallback((nextStatus: StatusFilter) => {
        setFilter(nextStatus);
        trackAdminEvent('admin_booking_status_filter_changed', { status: nextStatus });
    }, [trackAdminEvent]);

    const onChangePeriodMode = useCallback((nextMode: PeriodMode) => {
        setPeriodMode(nextMode);
        if (nextMode === 'range' && !rangeFrom && !rangeTo) {
            const today = toYmd(new Date());
            setRangeFrom(today);
            setRangeTo(today);
        }
        trackAdminEvent('admin_booking_period_mode_changed', { mode: nextMode });
    }, [rangeFrom, rangeTo, trackAdminEvent]);

    const onShiftPeriod = useCallback((direction: -1 | 1) => {
        setPeriodAnchor((current) => shiftAnchorDate(current, periodMode, direction));
        trackAdminEvent('admin_booking_period_navigated', {
            mode: periodMode,
            direction: direction > 0 ? 'next' : 'prev',
        });
    }, [periodMode, trackAdminEvent]);

    const filteredBookings = useMemo(() => {
        if (filter === 'ALL') return bookings;
        return bookings.filter((booking) => String(booking.status || '').toUpperCase() === filter);
    }, [bookings, filter]);

    const modalConfirmClass = useMemo(() => {
        if (!actionModal) return styles.modalConfirmButton;
        return actionModal.action === 'delete'
            ? `${styles.modalConfirmButton} ${styles.modalConfirmDangerButton}`
            : styles.modalConfirmButton;
    }, [actionModal]);

    return (
        <>
            <section className={styles.wrapper}>
                <header className={styles.stickyHeader}>
                    <div className={styles.headerTitleRow}>
                        <h2 className={styles.pageTitle}>Reservas</h2>
                        <span className={styles.resultCount}>{filteredBookings.length} resultados</span>
                    </div>

                    <div className={styles.headerControls}>
                        <div className={styles.controlBlock}>
                            <span className={styles.controlLabel}>Status</span>
                            <div className={styles.statusTabs}>
                                {STATUS_TABS.map((tab) => (
                                    <button
                                        key={tab.key}
                                        className={filter === tab.key ? styles.filterActive : styles.filter}
                                        onClick={() => onChangeStatus(tab.key)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.controlBlock}>
                            <span className={styles.controlLabel}>Período</span>
                            <div className={styles.periodModeTabs}>
                                {PERIOD_MODES.map((mode) => (
                                    <button
                                        key={mode.key}
                                        className={periodMode === mode.key ? styles.modeButtonActive : styles.modeButton}
                                        onClick={() => onChangePeriodMode(mode.key)}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>

                            <div className={styles.periodControls}>
                                {periodMode !== 'range' ? (
                                    <div className={styles.periodNavigator}>
                                        <button type="button" className={styles.navButton} onClick={() => onShiftPeriod(-1)}>
                                            {'<'}
                                        </button>
                                        <span className={styles.periodLabel}>{periodLabel}</span>
                                        <button type="button" className={styles.navButton} onClick={() => onShiftPeriod(1)}>
                                            {'>'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.rangeInputs}>
                                        <input
                                            type="date"
                                            className={styles.dateInput}
                                            value={rangeFrom}
                                            onChange={(event) => setRangeFrom(event.target.value)}
                                            aria-label="Data inicial"
                                        />
                                        <span className={styles.rangeSeparator}>até</span>
                                        <input
                                            type="date"
                                            className={styles.dateInput}
                                            value={rangeTo}
                                            onChange={(event) => setRangeTo(event.target.value)}
                                            aria-label="Data final"
                                        />
                                    </div>
                                )}
                            </div>

                            {isRangeInvalid ? (
                                <small className={styles.periodHint}>Intervalo inválido: mantendo comportamento atual sem filtro de data.</small>
                            ) : null}
                        </div>

                        <div className={styles.controlBlock}>
                            <span className={styles.controlLabel}>Analytics de teste</span>
                            <label className={styles.toggleLabel}>
                                <input
                                    type="checkbox"
                                    checked={analyticsTestMode}
                                    onChange={(event) => onToggleAnalyticsTestMode(event.target.checked)}
                                />
                                <span>Marcar eventos GA4 como teste</span>
                                <span className={analyticsTestMode ? styles.modeOnBadge : styles.modeOffBadge} title="Nao altera reservas ou pagamentos, apenas a marcacao dos eventos no analytics">
                                    {analyticsTestMode ? 'ATIVO' : 'DESLIGADO'}
                                </span>
                            </label>
                            {testPaymentsEnabled ? (
                                <small className={styles.testPaymentsNote}>Ação &quot;Aprovar pagamento de teste&quot; habilitada nas reservas.</small>
                            ) : null}
                        </div>
                    </div>
                </header>

                {actionFeedback ? (
                    <div className={actionFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError}>
                        {actionFeedback.message}
                    </div>
                ) : null}

                {loading && bookings.length > 0 ? (
                    <div className={styles.inlineLoading}>Atualizando listagem...</div>
                ) : null}

                {loading && bookings.length === 0 ? (
                    <div className={styles.loading}>Carregando...</div>
                ) : filteredBookings.length === 0 ? (
                    <div className={styles.empty}>
                        <p>Nenhuma reserva encontrada</p>
                    </div>
                ) : (
                    <div className={styles.cardsList}>
                        {filteredBookings.map((booking) => (
                            <BookingRowCard
                                key={booking.id}
                                booking={booking}
                                statusText={getStatusText(booking.status)}
                                statusClassName={getStatusBadge(booking.status)}
                                actionValue={actionSelectValue[booking.id] || ''}
                                actionBusy={Boolean(actionBusy)}
                                showActionBusy={Boolean(actionBusy?.bookingId === booking.id)}
                                testPaymentsEnabled={testPaymentsEnabled}
                                onActionSelect={onActionSelect}
                            />
                        ))}
                    </div>
                )}
            </section>

            {actionModal ? (
                <div className={styles.modalBackdrop} onClick={() => setActionModal(null)}>
                    <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <h3 className={styles.modalTitle}>{getActionLabel(actionModal.action)}</h3>
                        <p className={styles.modalDescription}>{getActionDescription(actionModal.action, actionModal.booking)}</p>
                        <div className={styles.modalMeta}>
                            <strong>Reserva:</strong> {actionModal.booking.id.slice(0, 8).toUpperCase()} - {actionModal.booking.guest.name}
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.modalCancelButton}
                                onClick={() => setActionModal(null)}
                                disabled={Boolean(actionBusy)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={modalConfirmClass}
                                onClick={confirmActionModal}
                                disabled={Boolean(actionBusy)}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
