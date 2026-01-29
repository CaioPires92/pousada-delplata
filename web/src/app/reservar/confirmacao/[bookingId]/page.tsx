'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Booking {
    id: string;
    roomType?: { name?: string };
    guest?: { name?: string; email?: string };
    checkIn: string;
    checkOut: string;
    totalPrice: number | string;
    status: string;
}

export default function ConfirmacaoPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const bookingId = params.bookingId as string;
    const status = searchParams.get('status');

    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchBooking = useCallback(async () => {
        if (!bookingId) return;
        try {
            const response = await fetch(`/api/bookings/${bookingId}`);
            if (response.ok) {
                const data = await response.json();
                setBooking(data);
            }
        } catch (error) {
            console.error('Error fetching booking:', error);
        } finally {
            setLoading(false);
        }
    }, [bookingId]);

    useEffect(() => {
        fetchBooking();
    }, [fetchBooking]);

    // Show alert when page loads with payment status
    useEffect(() => {
        if (!loading && status) {
            const statusMessages: Record<string, string> = {
                'approved': '✅ PAGAMENTO APROVADO!\n\nSua reserva foi confirmada com sucesso.',
                'pending': '⏳ PAGAMENTO PENDENTE\n\nSeu pagamento está sendo processado.\nVocê receberá um email quando for confirmado.',
                'rejected': '❌ PAGAMENTO RECUSADO\n\nNão foi possível processar seu pagamento.\nTente novamente com outro cartão.'
            };

            const message = statusMessages[status] || 'Reserva criada.';
            alert(message);
        }
    }, [loading, status]);

    const getStatusInfo = () => {
        switch (status) {
            case 'approved':
                return {
                    title: '✅ Pagamento Aprovado!',
                    message: 'Sua reserva foi confirmada com sucesso.',
                    color: '#4CAF50',
                };
            case 'pending':
                return {
                    title: '⏳ Pagamento Pendente',
                    message: 'Seu pagamento está sendo processado. Você receberá um email quando for confirmado.',
                    color: '#FF9800',
                };
            case 'rejected':
                return {
                    title: '❌ Pagamento Recusado',
                    message: 'Não foi possível processar seu pagamento. Tente novamente.',
                    color: '#F44336',
                };
            default:
                return {
                    title: '📋 Reserva Criada',
                    message: 'Sua reserva foi registrada.',
                    color: '#2196F3',
                };
        }
    };

    const statusInfo = getStatusInfo();

    if (loading) {
        return (
            <main className="container section">
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <p>Carregando informações da reserva...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="container section">
            <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                textAlign: 'center',
                padding: '2rem',
                border: `3px solid ${statusInfo.color}`,
                borderRadius: '8px',
                backgroundColor: '#f9f9f9',
            }}>
                <h1 style={{ color: statusInfo.color, marginBottom: '1rem' }}>
                    {statusInfo.title}
                </h1>
                <p style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
                    {statusInfo.message}
                </p>

                {booking && (
                    <div style={{
                        backgroundColor: 'white',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        marginBottom: '2rem',
                        textAlign: 'left',
                    }}>
                        <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>Detalhes da Reserva</h2>
                        <p><strong>Código:</strong> {booking.id.slice(0, 8).toUpperCase()}</p>
                        <p><strong>Quarto:</strong> {booking.roomType?.name}</p>
                        <p><strong>Hóspede:</strong> {booking.guest?.name}</p>
                        <p><strong>Email:</strong> {booking.guest?.email}</p>
                        <p><strong>Check-in:</strong> {new Date(booking.checkIn).toLocaleDateString('pt-BR')}</p>
                        <p><strong>Check-out:</strong> {new Date(booking.checkOut).toLocaleDateString('pt-BR')}</p>
                        <p><strong>Valor Total:</strong> R$ {Number(booking.totalPrice).toFixed(2)}</p>
                        <p><strong>Status:</strong> {booking.status}</p>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/" className="btn-primary">
                        Voltar ao Início
                    </Link>
                    {status === 'rejected' && (
                        <Link href={`/reservar?checkIn=${booking?.checkIn}&checkOut=${booking?.checkOut}`} className="btn-secondary">
                            Tentar Novamente
                        </Link>
                    )}
                </div>

                <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
                    <p>Você receberá um email de confirmação em breve.</p>
                    <p>Em caso de dúvidas, entre em contato conosco.</p>
                </div>
            </div>
        </main>
    );
}
