'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export default function ConfirmacaoPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const bookingId = params.bookingId as string;
    const initialStatus = searchParams.get('status');

    const [booking, setBooking] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // FUNÇÃO QUE CORRIGE O FUSO HORÁRIO (06/02)
    const formatarDataLocal = (dateString: string) => {
        if (!dateString) return '';
        const [ano, mes, dia] = dateString.split('T')[0].split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const fetchBooking = useCallback(async () => {
        if (!bookingId) return;
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const response = await fetch(`/api/bookings/${bookingId}`);
            if (response.ok) {
                const data = await response.json();
                setBooking(data);

                if (data.status === 'CONFIRMED') {
                    alert('✅ RESERVA CONFIRMADA!\n\nSeu pagamento foi aprovado com sucesso.');
                }
            }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, [bookingId]);

    useEffect(() => { fetchBooking(); }, [fetchBooking]);

    if (loading) return (
        <main style={{ paddingTop: '140px', textAlign: 'center' }}>
            <p>Sincronizando com a Pousada Delplata...</p>
        </main>
    );

    const isConfirmed = booking?.status === 'CONFIRMED';
    const accentColor = isConfirmed ? '#4CAF50' : '#FF9800';

    return (
        /* ADICIONADO: pt-140px para descer o texto da Navbar */
        <main style={{ paddingTop: '140px', paddingBottom: '60px', minHeight: '100vh', backgroundColor: '#fff' }}>
            <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                padding: '2rem',
                border: `3px solid ${accentColor}`,
                borderRadius: '12px',
                textAlign: 'center',
                backgroundColor: '#f9f9f9',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}>
                <h1 style={{ color: accentColor, marginBottom: '1.5rem' }}>
                    {isConfirmed ? '✅ Pagamento Aprovado!' : '⏳ Pagamento Pendente'}
                </h1>

                {booking && (
                    <div style={{ textAlign: 'left', background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee' }}>
                        <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', borderBottom: '1px solid #eee' }}>Sua Reserva</h2>
                        <p><strong>Quarto:</strong> {booking.roomType?.name}</p>
                        <p><strong>Hóspede:</strong> {booking.guest?.name}</p>

                        {/* DATAS CORRIGIDAS ABAIXO */}
                        <p><strong>Check-in:</strong> {formatarDataLocal(booking.checkIn)}</p>
                        <p><strong>Check-out:</strong> {formatarDataLocal(booking.checkOut)}</p>

                        <p><strong>Total:</strong> R$ {Number(booking.totalPrice).toFixed(2)}</p>
                        <p style={{ marginTop: '10px', color: accentColor, fontWeight: 'bold' }}>Status: {booking.status}</p>
                    </div>
                )}

                <div style={{ marginTop: '2rem' }}>
                    <Link href="/" style={{ padding: '12px 25px', background: '#000', color: '#fff', borderRadius: '6px', textDecoration: 'none' }}>
                        Voltar ao Início
                    </Link>
                </div>
            </div>
        </main>
    );
}