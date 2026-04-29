'use client';

import { useState } from 'react';
import { 
    User, 
    Calendar, 
    Mail, 
    Phone, 
    Home, 
    CreditCard, 
    Users, 
    MoreHorizontal,
    Clock,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Trash2,
    TestTube2
} from 'lucide-react';
import type { Booking } from './types';
import {
    formatCurrency,
    formatDateSafe,
    formatInstallments,
    formatPaymentBrand,
    formatPaymentType,
    getBookingCheckOutDate,
    getBookingGuestsLabel,
    getBookingOperationalDate,
    isBookingApproved,
    normalizeChildrenAges,
} from './booking-view';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import styles from './reservas.module.css';

type BookingRowCardProps = {
    booking: Booking;
    statusText: string;
    statusClassName: string;
    actionValue: string;
    actionBusy: boolean;
    showActionBusy: boolean;
    testPaymentsEnabled: boolean;
    onActionSelect: (booking: Booking, actionValue: string) => void;
};

export default function BookingRowCard(props: BookingRowCardProps) {
    const {
        booking,
        statusText,
        statusClassName,
        actionValue,
        actionBusy,
        showActionBusy,
        testPaymentsEnabled,
        onActionSelect,
    } = props;

    const childrenAges = normalizeChildrenAges(booking.childrenAges);
    const bookingApproved = isBookingApproved(booking);
    const bookingConfirmed = String(booking.status || '').toUpperCase() === 'CONFIRMED';
    const checkIn = formatDateSafe(getBookingOperationalDate(booking));
    const checkOut = formatDateSafe(getBookingCheckOutDate(booking));

    const triggerAction = (action: string) => {
        onActionSelect(booking, action);
    };

    return (
        <article className={styles.rowCard} data-testid={`booking-card-${booking.id}`}>
            <div className={styles.rowMain}>
                <div className={styles.identityBlock}>
                    <div className={styles.identityLine}>
                        <strong className={styles.guestName}>{booking.guest.name || 'Não informado'}</strong>
                        <span className={cn(styles.statusBadge, statusClassName)}>
                            {statusText}
                        </span>
                    </div>
                    <div className={styles.dateLine}>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>Check-in: <strong className="text-slate-900">{checkIn}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>Check-out: <strong className="text-slate-900">{checkOut}</strong></span>
                        </div>
                    </div>
                </div>

                <div className={styles.actionColumn}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="outline" 
                                className="rounded-xl font-bold h-10 px-4 gap-2 border-slate-200 hover:bg-slate-50 transition-all"
                                disabled={actionBusy}
                            >
                                <MoreHorizontal className="w-4 h-4" />
                                Ações
                                {showActionBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-slate-200 shadow-xl">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-3 py-2">
                                Gerenciar Reserva
                            </DropdownMenuLabel>
                            <DropdownMenuItem 
                                onClick={() => triggerAction('confirm')} 
                                disabled={bookingConfirmed}
                                className="gap-2 cursor-pointer font-semibold py-2.5"
                            >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Confirmar Reserva
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => triggerAction('expire')}
                                className="gap-2 cursor-pointer font-semibold py-2.5"
                            >
                                <Clock className="w-4 h-4 text-amber-500" />
                                Marcar como Expirada
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => triggerAction('assist')}
                                className="gap-2 cursor-pointer font-semibold py-2.5"
                            >
                                <HelpCircle className="w-4 h-4 text-blue-500" />
                                Enviar Ajuda
                            </DropdownMenuItem>
                            
                            {testPaymentsEnabled && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        onClick={() => triggerAction('test')} 
                                        disabled={bookingApproved}
                                        className="gap-2 cursor-pointer font-semibold py-2.5 text-indigo-600"
                                    >
                                        <TestTube2 className="w-4 h-4" />
                                        Aprovar Teste
                                    </DropdownMenuItem>
                                </>
                            )}
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                                onClick={() => triggerAction('delete')}
                                className="gap-2 cursor-pointer font-semibold py-2.5 text-red-600 focus:text-red-700 focus:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Excluir Permanentemente
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {showActionBusy ? <small className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 text-right">Processando...</small> : null}
                </div>
            </div>

            <div className={styles.rowMeta}>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Hóspede</span>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                        <Mail className="w-3 h-3 text-slate-300 shrink-0" />
                        <span className={styles.metaValueEllipsis} title={booking.guest.email}>
                            {booking.guest.email || '-'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-300 shrink-0" />
                        <span className={styles.metaSub}>{booking.guest.phone || '-'}</span>
                    </div>
                </div>
                
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Ocupação</span>
                    <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-slate-300 shrink-0" />
                        <span className={styles.metaValue}>{getBookingGuestsLabel(booking)}</span>
                    </div>
                    {childrenAges.length > 0 ? (
                        <span className={styles.metaSub}>Idades: {childrenAges.join(', ')}</span>
                    ) : null}
                </div>

                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Acomodação</span>
                    <div className="flex items-center gap-1.5">
                        <Home className="w-3 h-3 text-slate-300 shrink-0" />
                        <span className={styles.metaValue}>{booking.roomType.name || '-'}</span>
                    </div>
                </div>

                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Pagamento</span>
                    <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3 h-3 text-slate-300 shrink-0" />
                        <span className={styles.metaValue}>{formatPaymentType(booking.payment?.method)}</span>
                    </div>
                    <span className={styles.metaSub}>
                        {formatInstallments(booking.payment)} | {formatPaymentBrand(booking.payment)}
                    </span>
                </div>

                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Total</span>
                    <span className={styles.metaValueStrong}>{formatCurrency(booking.totalPrice)}</span>
                    <span className={styles.metaSub}>Desde {formatDateSafe(booking.createdAt)}</span>
                </div>
            </div>
        </article>
    );
}

function Loader2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
