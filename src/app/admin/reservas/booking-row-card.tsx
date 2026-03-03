'use client';

import { useState } from 'react';
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
    const checkIn = formatDateSafe(getBookingOperationalDate(booking));
    const checkOut = formatDateSafe(getBookingCheckOutDate(booking));
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const triggerAction = (action: string) => {
        onActionSelect(booking, action);
        setMobileMenuOpen(false);
    };

    return (
        <article className={styles.rowCard} data-testid={`booking-card-${booking.id}`}>
            <div className={styles.rowMain}>
                <div className={styles.identityBlock}>
                    <div className={styles.identityLine}>
                        <strong className={styles.guestName}>{booking.guest.name || 'Não informado'}</strong>
                        <span className={`${styles.statusBadge} ${statusClassName}`}>{statusText}</span>
                    </div>
                    <div className={styles.dateLine}>
                        <span>Check-in: {checkIn}</span>
                        <span>Check-out: {checkOut}</span>
                    </div>
                </div>

                <div className={styles.actionColumn}>
                    <div className={styles.desktopAction}>
                        <select
                            className={styles.actionSelect}
                            value={actionValue}
                            onChange={(event) => onActionSelect(booking, event.target.value)}
                            disabled={actionBusy}
                            aria-label={`Ações da reserva ${booking.id.slice(0, 8)}`}
                        >
                            <option value="">Selecionar ação...</option>
                            <option value="expire">Expirar reserva</option>
                            <option value="assist">Enviar ajuda</option>
                            <option value="delete">Excluir reserva</option>
                            {testPaymentsEnabled ? (
                                <option value="test" disabled={bookingApproved}>
                                    {bookingApproved ? 'Aprovar teste (já aprovada)' : 'Aprovar teste'}
                                </option>
                            ) : null}
                        </select>
                    </div>
                    <div className={styles.mobileAction}>
                        <button
                            type="button"
                            className={styles.mobileActionButton}
                            aria-label={`Abrir ações da reserva ${booking.id.slice(0, 8)}`}
                            onClick={() => setMobileMenuOpen((current) => !current)}
                            disabled={actionBusy}
                        >
                            ...
                        </button>
                        {mobileMenuOpen ? (
                            <div className={styles.mobileActionMenu}>
                                <button type="button" onClick={() => triggerAction('expire')} disabled={actionBusy}>
                                    Expirar reserva
                                </button>
                                <button type="button" onClick={() => triggerAction('assist')} disabled={actionBusy}>
                                    Enviar ajuda
                                </button>
                                <button type="button" onClick={() => triggerAction('delete')} disabled={actionBusy}>
                                    Excluir reserva
                                </button>
                                {testPaymentsEnabled ? (
                                    <button type="button" onClick={() => triggerAction('test')} disabled={actionBusy || bookingApproved}>
                                        {bookingApproved ? 'Aprovar teste (já aprovada)' : 'Aprovar teste'}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    {showActionBusy ? <small className={styles.actionHint}>Processando...</small> : null}
                </div>
            </div>

            <div className={styles.rowMeta}>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Contato</span>
                    <span className={styles.metaValueEllipsis} title={booking.guest.email}>
                        {booking.guest.email || '-'}
                    </span>
                    <span className={styles.metaSub}>{booking.guest.phone || '-'}</span>
                </div>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Hóspedes</span>
                    <span className={styles.metaValue}>{getBookingGuestsLabel(booking)}</span>
                    {childrenAges.length > 0 ? (
                        <span className={styles.metaSub}>Idades: {childrenAges.join(', ')}</span>
                    ) : null}
                </div>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Quarto</span>
                    <span className={styles.metaValue}>{booking.roomType.name || '-'}</span>
                </div>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Pagamento</span>
                    <span className={styles.metaValue}>{formatPaymentType(booking.payment?.method)}</span>
                    <span className={styles.metaSub}>
                        Parc.: {formatInstallments(booking.payment)} | Band.: {formatPaymentBrand(booking.payment)}
                    </span>
                </div>
                <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Valor</span>
                    <span className={styles.metaValueStrong}>{formatCurrency(booking.totalPrice)}</span>
                    <span className={styles.metaSub}>Criada em: {formatDateSafe(booking.createdAt)}</span>
                </div>
            </div>
        </article>
    );
}
