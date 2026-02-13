'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatDateBR } from '@/lib/date';

export default function ConfirmacaoPage() {
    const params = useParams();
    const bookingId = params.bookingId as string;

    const [booking, setBooking] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState('');
    const [polling, setPolling] = useState(false);
    const [statusToast, setStatusToast] = useState('');
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const lastStatusRef = useRef<string | null>(null);
    const redirectRef = useRef<NodeJS.Timeout | null>(null);

    const fetchBooking = useCallback(async () => {
        if (!bookingId) return;
        try {
            const response = await fetch(`/api/bookings/${bookingId}`);
            if (response.ok) {
                const data = await response.json();
                setBooking(data);

                const bookingStatus = String(data?.status || '').toUpperCase();
                const paymentStatus = String(data?.payment?.status || '').toUpperCase();
                const paymentMethod = String(data?.payment?.method || '').toUpperCase();
                const paymentRejectedStatuses = ['REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK'];

                const isConfirmedNow = bookingStatus === 'CONFIRMED' || paymentStatus === 'APPROVED';
                const isCancelledNow = bookingStatus === 'CANCELLED' || paymentRejectedStatuses.includes(paymentStatus);
                const effectiveStatus = isConfirmedNow ? 'CONFIRMED' : isCancelledNow ? 'CANCELLED' : 'PENDING';

                const prevStatus = lastStatusRef.current;
                lastStatusRef.current = effectiveStatus;

                if (effectiveStatus === 'CONFIRMED') {
                    setStatusMessage('✅ Pagamento aprovado! Sua reserva está confirmada.');
                    setPolling(false);
                    if (pollRef.current) clearInterval(pollRef.current);
                    if (prevStatus && prevStatus !== 'CONFIRMED') {
                        setStatusToast('Pagamento aprovado!');
                        setTimeout(() => setStatusToast(''), 3000);
                    }
                    if (redirectRef.current) {
                        clearTimeout(redirectRef.current);
                        redirectRef.current = null;
                    }
                } else if (effectiveStatus === 'CANCELLED') {
                    setStatusMessage('❌ Pagamento não aprovado. Sua reserva foi cancelada.');
                    setPolling(false);
                    if (pollRef.current) clearInterval(pollRef.current);
                    if (prevStatus && prevStatus !== 'CANCELLED') {
                        setStatusToast('Pagamento recusado.');
                        setTimeout(() => setStatusToast(''), 3000);
                    }
                } else {
                    const waitingPix = paymentMethod === 'PIX' || paymentMethod === '' || paymentMethod === 'UNKNOWN';
                    setStatusMessage(
                        waitingPix
                            ? '⏳ Pagamento pendente. Estamos aguardando a confirmação do Pix.'
                            : '⏳ Pagamento pendente. Estamos processando sua transação no cartão.'
                    );
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [bookingId]);

    useEffect(() => {
        fetchBooking();
        if (!pollRef.current) {
            setPolling(true);
            pollRef.current = setInterval(() => {
                fetchBooking();
            }, 10000);
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (redirectRef.current) clearTimeout(redirectRef.current);
        };
    }, [fetchBooking]);

    if (loading)
        return (
            <main style={{ paddingTop: '140px', textAlign: 'center' }}>
                <p>Sincronizando com a Pousada Delplata...</p>
            </main>
        );

    const bookingStatus = String(booking?.status || '').toUpperCase();
    const paymentStatus = String(booking?.payment?.status || '').toUpperCase();
    const paymentRejectedStatuses = ['REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK'];
    const isConfirmed = bookingStatus === 'CONFIRMED' || paymentStatus === 'APPROVED';
    const isCancelled = bookingStatus === 'CANCELLED' || paymentRejectedStatuses.includes(paymentStatus);
    const accentColor = isConfirmed ? '#0f172a' : isCancelled ? '#b91c1c' : '#FF9800';

    return (
        <main style={{ paddingTop: '140px', paddingBottom: '60px', minHeight: '100vh', backgroundColor: '#fff' }}>
            <div
                style={{
                    maxWidth: '600px',
                    margin: '0 auto',
                    padding: '2rem',
                    border: '3px solid ' + accentColor,
                    borderRadius: '12px',
                    textAlign: 'center',
                    backgroundColor: '#f9f9f9',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                }}
            >
                {statusToast ? (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#0f172a', color: '#fff', borderRadius: '8px' }}>
                        {statusToast}
                    </div>
                ) : null}
                <h1 style={{ color: accentColor, marginBottom: '1.5rem' }}>
                    {isConfirmed ? '✅ Pagamento Aprovado!' : isCancelled ? '❌ Pagamento Não Aprovado' : '⏳ Pagamento Pendente'}
                </h1>

                {booking && (
                    <div style={{ textAlign: 'left', background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee' }}>
                        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', borderBottom: '1px solid #eee' }}>Sua Reserva</h2>
                        <p>
                            <strong>Quarto:</strong> {booking.roomType?.name}
                        </p>
                        <p>
                            <strong>Hóspede:</strong> {booking.guest?.name}
                        </p>
                        <p>
                            <strong>Check-in:</strong> {formatDateBR(booking.checkIn)}
                        </p>
                        <p>
                            <strong>Check-out:</strong> {formatDateBR(booking.checkOut)}
                        </p>
                        <p>
                            <strong>Total:</strong> R$ {Number(booking.totalPrice).toFixed(2)}
                        </p>
                        <p style={{ marginTop: '10px', color: accentColor, fontWeight: 'bold' }}>
                            Status: {isConfirmed ? 'CONFIRMED' : isCancelled ? 'CANCELLED' : booking.status}
                        </p>
                        {booking?.payment?.method ? (
                            <p>
                                <strong>Método:</strong> {String(booking.payment.method)}
                            </p>
                        ) : null}
                        {booking?.payment?.status ? (
                            <p>
                                <strong>Status do pagamento:</strong> {String(booking.payment.status)}
                            </p>
                        ) : null}
                    </div>
                )}

                {statusMessage ? <div style={{ marginTop: '1rem', fontWeight: 600, color: accentColor }}>{statusMessage}</div> : null}

                {polling && !isConfirmed && !isCancelled ? (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#64748b' }}>Atualizando automaticamente a cada 10 segundos...</div>
                ) : null}

                <div style={{ marginTop: '2rem' }}>
                    <Link href="/" style={{ padding: '12px 25px', background: '#000', color: '#fff', borderRadius: '6px', textDecoration: 'none' }}>
                        Voltar ao Início
                    </Link>
                </div>
            </div>
        </main>
    );
}
