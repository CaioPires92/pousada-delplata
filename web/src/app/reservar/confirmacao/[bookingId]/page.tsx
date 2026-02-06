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

    // Status que vem na URL do Mercado Pago
    const initialStatus = searchParams.get('status');

    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);

    // FUNÇÃO PARA CORRIGIR O ERRO DE DATA (05 vs 06)
    const formatarDataSemFuso = (dateString: string) => {
        if (!dateString) return '';
        // Pega apenas a parte YYYY-MM-DD e ignora o resto
        const [ano, mes, dia] = dateString.split('T')[0].split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const fetchBooking = useCallback(async () => {
        if (!bookingId) return;
        try {
            // Delay de 2 segundos para dar tempo ao Webhook de atualizar o Turso
            await new Promise(resolve => setTimeout(resolve, 2000));

            const response = await fetch(`/api/bookings/${bookingId}`);
            if (response.ok) {
                const data = await response.json();
                setBooking(data);
            }
        } catch (error) {
            console.error('Erro ao buscar reserva:', error);
        } finally {
            setLoading(false);
        }
    }, [bookingId]);

    useEffect(() => {
        fetchBooking();
    }, [fetchBooking]);

    // LÓGICA DE ALERTAS INTELIGENTES
    useEffect(() => {
        if (!loading && booking) {
            const dbStatus = booking.status; // 'CONFIRMED', 'PENDING', etc.

            // Se no banco já está confirmado, ignoramos qualquer aviso de pendência da URL
            if (dbStatus === 'CONFIRMED') {
                alert('✅ RESERVA CONFIRMADA!\n\nSeu pagamento foi aprovado. Você receberá um e-mail com os detalhes em breve.');
            }
            // Se o banco ainda diz pendente E a URL também, mostramos o aviso de espera
            else if (initialStatus === 'pending' || dbStatus === 'PENDING') {
                alert('⏳ PAGAMENTO EM PROCESSAMENTO\n\nSeu pagamento está sendo validado. Assim que o Pix for compensado, a página atualizará.');
            }
            else if (initialStatus === 'rejected') {
                alert('❌ PAGAMENTO RECUSADO\n\nTente novamente ou utilize outro método de pagamento.');
            }
        }
    }, [loading, booking, initialStatus]);

    const isConfirmed = booking?.status === 'CONFIRMED';
    const accentColor = isConfirmed ? '#4CAF50' : '#FF9800';

    if (loading) {
        return (
            <main style={{ paddingTop: '140px', textAlign: 'center', minHeight: '100vh' }}>
                <p>Verificando sua reserva na Pousada Delplata...</p>
            </main>
        );
    }

    return (
        /* ADICIONADO: paddingTop de 140px para descer o conteúdo da Navbar */
        <main style={{ paddingTop: '140px', paddingBottom: '60px', minHeight: '100vh', backgroundColor: '#fff' }}>
            <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                textAlign: 'center',
                padding: '2.5rem',
                border: `2px solid ${accentColor}`,
                borderRadius: '12px',
                backgroundColor: '#fcfcfc',
                boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
            }}>
                <h1 style={{ color: accentColor, marginBottom: '1.5rem', fontSize: '2rem' }}>
                    {isConfirmed ? '✅ Reserva Confirmada!' : '⏳ Pagamento Pendente'}
                </h1>

                <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '2rem' }}>
                    {isConfirmed
                        ? 'Tudo pronto! Sua estadia na Pousada Delplata está garantida.'
                        : 'Estamos aguardando a confirmação do Mercado Pago.'}
                </p>

                {booking && (
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '10px',
                        marginBottom: '2rem',
                        textAlign: 'left',
                        border: '1px solid #eee',
                        lineHeight: '1.8'
                    }}>
                        <h2 style={{ marginBottom: '1.2rem', fontSize: '1.4rem', borderBottom: '1px solid #f0f0f0' }}>Detalhes da Reserva</h2>
                        <p><strong>Código:</strong> <span style={{ color: '#666' }}>{booking.id.toUpperCase()}</span></p>
                        <p><strong>Quarto:</strong> {booking.roomType?.name}</p>
                        <p><strong>Hóspede:</strong> {booking.guest?.name}</p>

                        {/* DATAS CORRIGIDAS AQUI */}
                        <p><strong>Check-in:</strong> {formatarDataSemFuso(booking.checkIn)}</p>
                        <p><strong>Check-out:</strong> {formatarDataSemFuso(booking.checkOut)}</p>

                        <p><strong>Valor Total:</strong> R$ {Number(booking.totalPrice).toFixed(2)}</p>

                        <div style={{
                            marginTop: '15px',
                            padding: '8px 15px',
                            backgroundColor: isConfirmed ? '#e8f5e9' : '#fff3e0',
                            display: 'inline-block',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: isConfirmed ? '#2e7d32' : '#ef6c00'
                        }}>
                            Status do Sistema: {booking.status}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <Link href="/" style={{
                        padding: '12px 25px',
                        backgroundColor: '#000',
                        color: '#fff',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: '600'
                    }}>
                        Voltar ao Início
                    </Link>
                </div>

                <div style={{ marginTop: '2.5rem', fontSize: '0.9rem', color: '#888', borderTop: '1px solid #f0f0f0', paddingTop: '1.5rem' }}>
                    <p>Enviamos um resumo para o e-mail: <strong>{booking?.guest?.email}</strong></p>
                    <p style={{ marginTop: '10px' }}>Dúvidas? Entre em contato pelo nosso WhatsApp.</p>
                </div>
            </div>
        </main>
    );
}