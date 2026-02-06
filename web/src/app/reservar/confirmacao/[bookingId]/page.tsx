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

    // Pegamos o status inicial da URL do Mercado Pago
    const initialStatus = searchParams.get('status');

    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentStatus, setCurrentStatus] = useState<string | null>(initialStatus);

    const fetchBooking = useCallback(async () => {
        if (!bookingId) return;
        try {
            // Pequeno delay de 1.5s para dar tempo ao Webhook de processar o banco
            await new Promise(resolve => setTimeout(resolve, 1500));

            const response = await fetch(`/api/bookings/${bookingId}`);
            if (response.ok) {
                const data = await response.json();
                setBooking(data);
                // Atualizamos o status com o que está REALMENTE no banco agora
                setCurrentStatus(data.status.toLowerCase() === 'confirmed' ? 'approved' : data.status.toLowerCase());
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

    // Alerta inteligente: só avisa se o banco confirmar que ainda está pendente
    useEffect(() => {
        if (!loading && booking) {
            const statusToNotify = booking.status.toLowerCase();

            if (statusToNotify === 'pending' || initialStatus === 'pending') {
                // Se no banco já estiver CONFIRMED, não mostramos o alerta de pendente
                if (booking.status !== 'CONFIRMED') {
                    alert('⏳ PAGAMENTO SENDO PROCESSADO\n\nSeu pagamento está sendo processado.\nVocê receberá um email quando for confirmado.');
                }
            } else if (initialStatus === 'approved' || booking.status === 'CONFIRMED') {
                alert('✅ PAGAMENTO APROVADO!\n\nSua reserva foi confirmada com sucesso.');
            } else if (initialStatus === 'rejected') {
                alert('❌ PAGAMENTO RECUSADO\n\nNão foi possível processar seu pagamento.\nTente novamente com outro cartão.');
            }
        }
    }, [loading, booking, initialStatus]);

    const getStatusInfo = () => {
        // Prioriza o status real do banco (booking.status)
        const dbStatus = booking?.status;

        if (dbStatus === 'CONFIRMED' || initialStatus === 'approved') {
            return {
                title: '✅ Pagamento Aprovado!',
                message: 'Sua reserva foi confirmada com sucesso.',
                color: '#4CAF50',
            };
        }

        switch (initialStatus) {
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
            <main className="container section" style={{ paddingTop: '120px' }}>
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <p>Verificando confirmação do pagamento...</p>
                </div>
            </main>
        );
    }

    return (
        // ADICIONADO: paddingTop: '120px' para descer o conteúdo abaixo da Navbar
        <main className="container section" style={{ paddingTop: '120px', minHeight: '100vh', paddingBottom: '40px' }}>
            <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                textAlign: 'center',
                padding: '2rem',
                border: `3px solid ${statusInfo.color}`,
                borderRadius: '8px',
                backgroundColor: '#f9f9f9',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
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
                        border: '1px solid #eee'
                    }}>
                        <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>Detalhes da Reserva</h2>
                        <p><strong>Código:</strong> {booking.id.slice(0, 8).toUpperCase()}</p>
                        <p><strong>Quarto:</strong> {booking.roomType?.name}</p>
                        <p><strong>Hóspede:</strong> {booking.guest?.name}</p>
                        <p><strong>Check-in:</strong> {new Date(booking.checkIn).toLocaleDateString('pt-BR')}</p>
                        <p><strong>Check-out:</strong> {new Date(booking.checkOut).toLocaleDateString('pt-BR')}</p>
                        <p><strong>Valor Total:</strong> R$ {Number(booking.totalPrice).toFixed(2)}</p>
                        <p style={{
                            marginTop: '10px',
                            padding: '5px 10px',
                            backgroundColor: booking.status === 'CONFIRMED' ? '#e8f5e9' : '#fff3e0',
                            display: 'inline-block',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            color: booking.status === 'CONFIRMED' ? '#2e7d32' : '#ef6c00'
                        }}>
                            Status: {booking.status}
                        </p>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/" className="btn-primary">
                        Voltar ao Início
                    </Link>
                    {initialStatus === 'rejected' && (
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