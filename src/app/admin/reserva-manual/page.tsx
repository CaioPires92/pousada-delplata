'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildPaymentBrickInitializationPayer, normalizePaymentBrickPayer } from '../../reservar/payment-brick';
import styles from '../reservas/reservas.module.css';

interface RoomType {
    id: string;
    name: string;
}

export default function ReservaManualPage() {
    const router = useRouter();
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(false);
    const [roomsLoading, setRoomsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
    const [paymentError, setPaymentError] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'approved' | 'rejected' | 'pending' | 'error'>('idle');
    const [paymentStatusMessage, setPaymentStatusMessage] = useState('');
    const [pixData, setPixData] = useState<{ qr_code?: string; qr_code_base64?: string; ticket_url?: string } | null>(null);
    const paymentBrickRef = useRef<any>(null);
    const pollRef = useRef<number | null>(null);
    const paymentSectionId = 'manualPaymentSection';
    const paymentContainerId = 'manualPaymentBrick_container';

    // Form state
    const [formData, setFormData] = useState({
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        checkIn: '',
        checkOut: '',
        roomTypeId: '',
        totalPrice: '',
        adults: '2',
        children: '0'
    });

    useEffect(() => {
        async function fetchRooms() {
            try {
                const res = await fetch('/api/rooms');
                if (!res.ok) throw new Error('Erro ao buscar tipos de quarto');
                const data = await res.json();
                setRoomTypes(data);
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, roomTypeId: data[0].id }));
                }
            } catch (err) {
                console.error(err);
                setError('Falha ao carregar quartos. Por favor, recarregue a página.');
            } finally {
                setRoomsLoading(false);
            }
        }
        fetchRooms();
    }, []);

    useEffect(() => {
        return () => {
            if (paymentBrickRef.current) {
                void paymentBrickRef.current.unmount?.();
                paymentBrickRef.current = null;
            }
        };
    }, []);

    const buildPayerData = useCallback(
        () => buildPaymentBrickInitializationPayer(formData.guestEmail),
        [formData.guestEmail]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (paymentBookingId) {
            setError('Esta reserva já foi criada. Conclua o pagamento abaixo ou recarregue a página para criar outra.');
            return;
        }
        
        // Basic number validation
        const price = Number(formData.totalPrice);
        if (isNaN(price) || price <= 0) {
            setError('Por favor, insira um valor total válido (maior que zero).');
            return;
        }

        const adults = Number(formData.adults);
        if (isNaN(adults) || adults < 1) {
            setError('É necessário pelo menos 1 adulto.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/admin/manual-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            // Se for 500, tentar pegar os detalhes enviados pelo logger aprimorado
            const data = await res.json().catch(() => ({ error: 'Erro de resposta do servidor' }));

            if (!res.ok) {
                const detailedError = data.details ? `${data.error}: ${data.details}` : data.error;
                throw new Error(detailedError || 'Erro ao criar reserva manual');
            }

            const bookingId = String(data.bookingId || '');
            const amount = Number(data.totalPrice);

            if (!bookingId || !Number.isFinite(amount) || amount <= 0) {
                throw new Error('Reserva criada, mas os dados de pagamento não foram retornados corretamente.');
            }

            setPaymentBookingId(bookingId);
            setPaymentAmount(amount);
            setPaymentError('');
            setPaymentStatus('idle');
            setPaymentStatusMessage('');
            setPixData(null);
            setLoading(false);

            setTimeout(() => {
                document.getElementById(paymentSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } catch (err: any) {
            console.error('Frontend Error:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!paymentBookingId || paymentAmount === null || Number.isNaN(paymentAmount)) return;

        let cancelled = false;
        const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
        if (!publicKey) {
            setPaymentError('Chave pública do Mercado Pago não configurada.');
            return;
        }

        if (paymentAmount <= 0) {
            setPaymentError('Nao foi possivel carregar o formulario de pagamento: valor da reserva deve ser maior que zero.');
            return;
        }

        const loadSdk = () => new Promise<void>((resolve, reject) => {
            if (typeof window === 'undefined') return resolve();
            if ((window as any).MercadoPago) return resolve();
            const script = document.createElement('script');
            script.src = 'https://sdk.mercadopago.com/js/v2';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago'));
            document.body.appendChild(script);
        });

        const initBrick = async () => {
            try {
                await loadSdk();
                if (cancelled) return;

                const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
                const bricksBuilder = mp.bricks();

                if (paymentBrickRef.current) {
                    await paymentBrickRef.current.unmount();
                }

                    paymentBrickRef.current = await bricksBuilder.create('payment', paymentContainerId, {
                        initialization: {
                            amount: paymentAmount,
                            payer: {
                                ...buildPayerData(),
                                entityType: 'individual',
                            },
                        },
                    customization: {
                        paymentMethods: {
                            creditCard: 'all',
                            debitCard: 'all',
                            bankTransfer: 'all',
                        },
                    },
                    callbacks: {
                        onReady: () => {
                            // Brick pronto
                        },
                        onSubmit: ({ formData }: any) => {
                            const normalizedPayer = normalizePaymentBrickPayer({
                                payerFromBrick: formData?.payer,
                                guestName: formData.guestName,
                                guestEmail: formData.guestEmail,
                            });

                            return fetch('/api/mercadopago/payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    ...formData,
                                    payer: normalizedPayer,
                                    bookingId: paymentBookingId,
                                    description: `Reserva ${paymentBookingId}`,
                                    transaction_amount: paymentAmount,
                                }),
                            }).then(async (res) => {
                                const responseData = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                    const msg = responseData?.message || responseData?.error || 'Erro ao processar pagamento';
                                    setPaymentStatus('error');
                                    setPaymentStatusMessage(msg);
                                    throw new Error(msg);
                                }

                                const status = String(responseData?.status || '').toLowerCase();
                                const pix = responseData?.pix;
                                if (pix) setPixData(pix);

                                if (status === 'approved') {
                                    setPaymentStatus('approved');
                                    setPaymentStatusMessage('Pagamento aprovado! Redirecionando...');
                                    window.location.href = '/admin/reservas';
                                    return;
                                }

                                if (status === 'rejected') {
                                    setPaymentStatus('rejected');
                                    setPaymentStatusMessage('Pagamento recusado. Tente outro método.');
                                    return;
                                }

                                setPaymentStatus('pending');
                                if (pix?.qr_code || pix?.qr_code_base64) {
                                    setPaymentStatusMessage('Pix gerado. Escaneie o QR Code ou copie o código.');
                                } else {
                                    setPaymentStatusMessage('Pagamento em análise. Aguarde a confirmação.');
                                }
                            });
                        },
                        onError: (err: any) => {
                            console.error('Mercado Pago Brick Error:', err);
                            setPaymentStatus('error');
                            const errorMessage = String(err?.message || err?.error || '');
                            if (/dado obrigat[oó]rio|required/i.test(errorMessage)) {
                                setPaymentError('Preencha o nome do titular manualmente (sem auto preenchimento) e tente novamente.');
                                return;
                            }
                            setPaymentError('Nao foi possivel carregar o formulario de pagamento. Atualize a pagina e tente sem bloqueadores de anuncio.');
                        },
                    },
                });
            } catch (err) {
                console.error(err);
                setPaymentError('Nao foi possivel inicializar o pagamento. Verifique sua conexao e tente novamente.');
            }
        };

        initBrick();
        return () => {
            cancelled = true;
            if (pollRef.current) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [buildPayerData, paymentAmount, paymentBookingId]);

    useEffect(() => {
        if (!paymentBookingId) return;
        if (pollRef.current) return;

        pollRef.current = window.setInterval(async () => {
            try {
                const res = await fetch(`/api/bookings/${paymentBookingId}`);
                if (!res.ok) return;

                const data = await res.json();
                if (data?.status === 'CONFIRMED') {
                    setPaymentStatus('approved');
                    setPaymentStatusMessage('Pagamento aprovado! Redirecionando...');
                    if (pollRef.current) {
                        window.clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                    window.location.href = '/admin/reservas';
                    return;
                }

                if (data?.status === 'CANCELLED') {
                    setPaymentStatus('rejected');
                    setPaymentStatusMessage('Pagamento recusado. Tente outro método.');
                    if (pollRef.current) {
                        window.clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                }
            } catch {
                // ignore transient network errors
            }
        }, 10000);

        return () => {
            if (pollRef.current) {
                window.clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [paymentBookingId]);

    if (roomsLoading) {
        return <div className={styles.loading}>Carregando formulário...</div>;
    }

    return (
        <div className={styles.wrapper}>
            <header className={styles.stickyHeader}>
                <div className={styles.headerTitleRow}>
                    <h2 className={styles.pageTitle}>Nova Reserva Manual</h2>
                    {process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.startsWith('TEST-') ? (
                        <span className="ml-4 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded border border-amber-200">
                            MODO TESTE (SANDBOX)
                        </span>
                    ) : (
                        <span className="ml-4 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded border border-green-200">
                            MODO PRODUÇÃO
                        </span>
                    )}
                </div>
            </header>

            <div className="max-w-[800px] mx-auto mt-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Seção Hóspede */}
                        <div className="space-y-4 col-span-2">
                            <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">Dados do Hóspede</h3>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                                <input
                                    required
                                    type="text"
                                    name="guestName"
                                    value={formData.guestName}
                                    onChange={handleChange}
                                    disabled={Boolean(paymentBookingId)}
                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: João Silva"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Email do hotel/pagador</label>
                                    <input
                                        required
                                        type="email"
                                        name="guestEmail"
                                        value={formData.guestEmail}
                                        onChange={handleChange}
                                        disabled={Boolean(paymentBookingId)}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="email@exemplo.com"
                                    />
                                    <p className="text-[10px] text-slate-400 leading-tight">
                                        Use o e-mail operacional do hotel nesta reserva manual se você não quiser notificar o hóspede.
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Telefone do hotel/pagador</label>
                                    <input
                                        type="tel"
                                        name="guestPhone"
                                        value={formData.guestPhone}
                                        onChange={handleChange}
                                        disabled={Boolean(paymentBookingId)}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção Estadia */}
                        <div className="space-y-4 col-span-2 mt-4">
                            <h3 className="text-lg font-semibold border-b pb-2 text-slate-800">Detalhes da Estadia</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Check-in</label>
                                <input
                                    required
                                    type="date"
                                    name="checkIn"
                                    value={formData.checkIn}
                                    onChange={handleChange}
                                    disabled={Boolean(paymentBookingId)}
                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Check-out</label>
                                <input
                                    required
                                    type="date"
                                    name="checkOut"
                                    value={formData.checkOut}
                                    onChange={handleChange}
                                    disabled={Boolean(paymentBookingId)}
                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Tipo de Quarto</label>
                                <select
                                    required
                                    name="roomTypeId"
                                    value={formData.roomTypeId}
                                    onChange={handleChange}
                                    disabled={Boolean(paymentBookingId)}
                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    {roomTypes.map(room => (
                                        <option key={room.id} value={room.id}>{room.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Adultos</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    name="adults"
                                    value={formData.adults}
                                    onChange={handleChange}
                                    disabled={Boolean(paymentBookingId)}
                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Crianças</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    name="children"
                                    value={formData.children}
                                    onChange={handleChange}
                                    disabled={Boolean(paymentBookingId)}
                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                </div>
                            </div>
                        </div>

                        {/* Seção Financeira */}
                        <div className="space-y-4 col-span-2 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">Financeiro</h3>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Valor Total da Reserva (R$)</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    name="totalPrice"
                                    value={formData.totalPrice}
                                    onChange={handleChange}
                                    disabled={Boolean(paymentBookingId)}
                                    className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none text-xl font-bold text-green-700"
                                    placeholder="0,00"
                                />
                                <p className="text-xs text-slate-500">Este valor será enviado exatamente ao Mercado Pago para cobrança.</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t flex justify-end">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="mr-4 px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || Boolean(paymentBookingId)}
                            className={`px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold shadow-lg hover:bg-blue-700 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {paymentBookingId ? 'Reserva criada' : loading ? 'Processando...' : 'Gerar Reserva e Pagar'}
                        </button>
                    </div>
                </form>

                {paymentBookingId ? (
                    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" id={paymentSectionId}>
                        <div className="mb-4">
                            <h3 className="text-xl font-semibold text-slate-800">Pagamento da reserva</h3>
                            <p className="text-sm text-slate-600">
                                Conclua o pagamento aqui no painel. O checkout externo do Mercado Pago não será aberto neste fluxo.
                            </p>
                            <p className="mt-2 text-sm text-slate-600">
                                Reserva <span className="font-medium">{paymentBookingId}</span> - R$ {Number(paymentAmount || 0).toFixed(2)}
                            </p>
                        </div>

                        {paymentError ? (
                            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {paymentError}
                            </div>
                        ) : null}

                        {paymentStatusMessage ? (
                            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {paymentStatusMessage}
                            </div>
                        ) : null}

                        {paymentStatus === 'pending' && pixData?.qr_code_base64 ? (
                            <div className="mb-4 rounded-lg border border-slate-200 p-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                                    alt="QR Code Pix"
                                    className="max-w-[240px]"
                                />
                                {pixData.qr_code ? (
                                    <textarea
                                        readOnly
                                        value={pixData.qr_code}
                                        className="mt-3 w-full rounded-md border border-slate-200 p-3 text-xs"
                                        rows={4}
                                    />
                                ) : null}
                            </div>
                        ) : null}

                        <div id={paymentContainerId} />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
