'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Search, 
    Filter, 
    Calendar, 
    BarChart3, 
    CheckCircle2, 
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Loader2,
    RefreshCw,
    XCircle,
    Info,
    Tag
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import styles from './reservas.module.css';

type ActionModalState = {
    booking: Booking;
    action: BookingAction;
};

type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
    { key: 'ALL', label: 'Todas' },
    { key: 'PENDING', label: 'Pendentes' },
    { key: 'CONFIRMED', label: 'Confirmadas' },
    { key: 'CANCELLED', label: 'Canceladas' },
    { key: 'REFUNDED', label: 'Estornadas' },
    { key: 'EXPIRED', label: 'Expiradas' },
];

const PERIOD_MODES: Array<{ key: PeriodMode; label: string }> = [
    { key: 'all-time', label: 'Todo o período' },
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
        discount: 'Enviar desconto',
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
    if (action === 'discount') return 'Será criado um cupom individual de 10%, válido por 7 dias e limitado a um uso.';
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
    const [dateField, setDateField] = useState<'createdAt' | 'checkIn'>('createdAt');
    const [periodMode, setPeriodMode] = useState<PeriodMode>('all-time');
    const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [isDateFieldOpen, setIsDateFieldOpen] = useState(false);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [actionBusy, setActionBusy] = useState<{ bookingId: string; action: BookingAction } | null>(null);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
    const [actionSelectValue, setActionSelectValue] = useState<Record<string, string>>({});
    const [discountChannels, setDiscountChannels] = useState({ email: true, whatsapp: true });

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
        gaEvent(eventName, payload);
    }, []);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const query = buildBookingsQuery({
                status: filter,
                mode: periodMode,
                anchorDate: periodAnchor,
                customFrom: rangeFrom,
                customTo: rangeTo,
                dateField,
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
    }, [filter, periodMode, periodAnchor, rangeFrom, rangeTo, dateField, router]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchBookings();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [fetchBookings]);

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

    const sendDiscount = useCallback(async (booking: Booking) => {
        setActionBusy({ bookingId: booking.id, action: 'discount' });
        setActionFeedback(null);

        try {
            const response = await fetch(`/api/admin/bookings/${booking.id}/discount`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channels: discountChannels }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || data?.error || 'Não foi possível enviar o desconto.');
            }

            setActionFeedback({
                type: 'success',
                message: `Cupom ${data.code} criado${discountChannels.email ? ' e enviado por e-mail' : ''}.`,
            });
            if (discountChannels.whatsapp && data.whatsappUrl) {
                window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (error) {
            setActionFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Não foi possível enviar o desconto.',
            });
        } finally {
            setActionBusy(null);
        }
    }, [discountChannels]);

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

        if (action === 'discount') {
            await sendDiscount(booking);
            return;
        }

        if (action === 'test') {
            await approveTestPayment(booking.id);
        }
    }, [approveTestPayment, confirmBooking, deleteBooking, markBookingExpired, sendAssistEmail, sendDiscount]);

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
        if (action === 'discount') {
            setDiscountChannels({
                email: Boolean(booking.guest.email),
                whatsapp: Boolean(booking.guest.phone),
            });
        }
        trackAdminEvent('admin_booking_action_selected', {
            action,
            booking_id_short: booking.id.slice(0, 8).toUpperCase(),
        });
        setActionModal({ booking, action });
    }, [trackAdminEvent]);

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
        <div className="min-h-screen bg-slate-50/50 pb-20">
            <section className={styles.wrapper}>
                <header className={styles.stickyHeader}>
                    <div className={styles.headerTitleRow}>
                        <div className="flex items-center gap-4">
                            <BarChart3 className="w-8 h-8 text-slate-900" />
                            <h2 className={styles.pageTitle}>Gerenciamento de Reservas</h2>
                        </div>
                        <span className={styles.resultCount}>
                            <Search className="w-3 h-3 inline-block mr-2" />
                            {filteredBookings.length} resultados
                        </span>
                    </div>

                    <div className="flex flex-wrap items-end gap-x-8 gap-y-5 w-full mt-4">
                        {/* Status Filter */}
                        <div className="flex flex-col gap-1.5 min-w-[170px]">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 pl-1">Filtrar por Status</span>
                            <div className="relative">
                                <button 
                                    type="button"
                                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                    className={`w-full flex items-center justify-between gap-3 text-[11px] font-bold text-slate-700 bg-white border ${isStatusDropdownOpen ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'} rounded-xl px-4 py-2.5 uppercase tracking-wide shadow-sm transition-all outline-none`}
                                >
                                    {STATUS_TABS.find(t => t.key === filter)?.label || 'Todas'}
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </button>
                                {isStatusDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsStatusDropdownOpen(false)} />
                                        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[170px] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {STATUS_TABS.map((tab) => (
                                                <button
                                                    key={tab.key}
                                                    type="button"
                                                    className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors outline-none ${filter === tab.key ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                                    onClick={() => { 
                                                        onChangeStatus(tab.key); 
                                                        setIsStatusDropdownOpen(false); 
                                                    }}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-[1px] h-10 bg-slate-200/80 hidden md:block mx-1"></div>

                        {/* Date Filter Block */}
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[340px]">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 pl-1">Filtro de Datas</span>
                            <div className="flex flex-wrap items-center gap-3">
                                
                                {/* Date Type Selector */}
                                <div className="relative min-w-[170px]">
                                    <button 
                                        type="button"
                                        onClick={() => setIsDateFieldOpen(!isDateFieldOpen)}
                                        className={`w-full flex items-center justify-between gap-3 text-[11px] font-bold text-slate-700 bg-white border ${isDateFieldOpen ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'} rounded-xl px-4 py-2.5 uppercase tracking-wide shadow-sm transition-all outline-none`}
                                    >
                                        {dateField === 'createdAt' ? 'Novas Reservas' : 'Por Check-in'}
                                        <ChevronDown className="w-3 h-3 text-slate-400" />
                                    </button>
                                    {isDateFieldOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsDateFieldOpen(false)} />
                                            <div className="absolute top-full left-0 mt-1.5 w-full min-w-[170px] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <button 
                                                    type="button"
                                                    className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors outline-none ${dateField === 'createdAt' ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                                    onClick={() => { setDateField('createdAt'); setIsDateFieldOpen(false); trackAdminEvent('admin_booking_date_field_changed', { field: 'createdAt' }); }}
                                                >
                                                    Novas Reservas
                                                </button>
                                                <button 
                                                    type="button"
                                                    className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors outline-none ${dateField === 'checkIn' ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                                    onClick={() => { setDateField('checkIn'); setIsDateFieldOpen(false); trackAdminEvent('admin_booking_date_field_changed', { field: 'checkIn' }); }}
                                                >
                                                    Por Check-in
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Period Tabs */}
                                <div className="flex p-1 bg-slate-100/70 rounded-xl border border-slate-200/50 shadow-inner">
                                    {PERIOD_MODES.map((mode) => (
                                        <button
                                            key={mode.key}
                                            className={`outline-none px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${periodMode === mode.key ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 border border-transparent'}`}
                                            onClick={() => onChangePeriodMode(mode.key)}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Period Navigator / Range Inputs */}
                                {periodMode !== 'all-time' && (
                                    <div className="flex items-center ml-1">
                                        {periodMode !== 'range' ? (
                                            <div className="flex items-center bg-white border border-slate-200/80 rounded-xl shadow-sm p-1">
                                                <button type="button" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-500 transition-colors outline-none" onClick={() => onShiftPeriod(-1)}>
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <span className="px-3 min-w-[110px] text-center whitespace-nowrap text-[12px] font-bold text-slate-700">{periodLabel}</span>
                                                <button type="button" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-500 transition-colors outline-none" onClick={() => onShiftPeriod(1)}>
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl shadow-sm p-1.5 px-3">
                                                <input
                                                    type="date"
                                                    className="bg-transparent text-[11px] font-bold text-slate-700 outline-none border-none cursor-pointer"
                                                    value={rangeFrom}
                                                    onChange={(event) => setRangeFrom(event.target.value)}
                                                />
                                                <span className="text-[10px] font-extrabold uppercase text-slate-300">até</span>
                                                <input
                                                    type="date"
                                                    className="bg-transparent text-[11px] font-bold text-slate-700 outline-none border-none cursor-pointer"
                                                    value={rangeTo}
                                                    onChange={(event) => setRangeTo(event.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {isRangeInvalid ? (
                                <div className="flex items-center gap-1.5 mt-2 text-amber-600">
                                    <AlertCircle className="w-3 h-3" />
                                    <small className="font-bold uppercase text-[10px]">Intervalo inválido</small>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </header>

                {actionFeedback ? (
                    <div className={cn(
                        "p-4 rounded-2xl border flex items-center gap-3 font-bold text-sm animate-in fade-in slide-in-from-top-4",
                        actionFeedback.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
                    )}>
                        {actionFeedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {actionFeedback.message}
                    </div>
                ) : null}

                {loading && bookings.length > 0 ? (
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest pl-4">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Atualizando...
                    </div>
                ) : null}

                {loading && bookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-slate-200" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando Reservas...</p>
                    </div>
                ) : filteredBookings.length === 0 ? (
                    <Card className="border-none shadow-none bg-white/50 border border-slate-100 py-20 flex flex-col items-center justify-center gap-4 rounded-[32px]">
                        <Search className="w-12 h-12 text-slate-200" />
                        <div className="text-center">
                            <p className="text-slate-900 font-extrabold text-xl">Nenhuma reserva encontrada</p>
                            <p className="text-slate-400 font-medium">Tente alterar os filtros ou o período de busca.</p>
                        </div>
                        <Button variant="outline" onClick={() => {setFilter('ALL'); setPeriodMode('month');}} className="rounded-xl font-bold mt-4">
                            Limpar Filtros
                        </Button>
                    </Card>
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
                        <div className="flex items-center gap-3 mb-6 text-red-600">
                             {actionModal.action === 'delete'
                                 ? <XCircle className="w-8 h-8" />
                                 : actionModal.action === 'discount'
                                     ? <Tag className="w-8 h-8 text-violet-600" />
                                     : <Info className="w-8 h-8 text-slate-900" />}
                             <h3 className={styles.modalTitle}>{getActionLabel(actionModal.action)}</h3>
                        </div>
                        
                        <p className={styles.modalDescription}>{getActionDescription(actionModal.action, actionModal.booking)}</p>

                        {actionModal.action === 'discount' ? (
                            <fieldset className="mb-6 space-y-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                                <legend className="px-1 text-xs font-bold uppercase tracking-widest text-violet-700">Canais de envio</legend>
                                <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={discountChannels.email}
                                        onChange={(event) => setDiscountChannels((current) => ({ ...current, email: event.target.checked }))}
                                        disabled={!actionModal.booking.guest.email}
                                        className="h-4 w-4 accent-violet-600"
                                    />
                                    E-mail automático
                                </label>
                                <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={discountChannels.whatsapp}
                                        onChange={(event) => setDiscountChannels((current) => ({ ...current, whatsapp: event.target.checked }))}
                                        disabled={!actionModal.booking.guest.phone}
                                        className="h-4 w-4 accent-violet-600"
                                    />
                                    Abrir mensagem pronta no WhatsApp
                                </label>
                                <p className="text-xs text-slate-500">O WhatsApp será aberto para você revisar e confirmar o envio.</p>
                            </fieldset>
                        ) : null}
                        
                        <div className="bg-slate-50 p-4 rounded-2xl mb-8 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Referência</p>
                            <p className="font-bold text-slate-900">
                                {actionModal.booking.id.slice(0, 8).toUpperCase()} — {actionModal.booking.guest.name}
                            </p>
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
                                disabled={Boolean(actionBusy) || (actionModal.action === 'discount' && !discountChannels.email && !discountChannels.whatsapp)}
                            >
                                {actionBusy ? 'Processando...' : 'Confirmar Ação'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
