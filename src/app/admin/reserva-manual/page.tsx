'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    User, 
    Calendar, 
    Home, 
    CreditCard, 
    Phone, 
    Mail, 
    Users, 
    ChevronLeft,
    CheckCircle2,
    AlertCircle,
    QrCode,
    Loader2,
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { buildPaymentBrickInitializationPayer, normalizePaymentBrickPayer } from '../../reservar/payment-brick';
import { cn } from '@/lib/utils';
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
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                <p className="text-slate-500 font-medium">Carregando formulário...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => router.back()}
                            className="rounded-full"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <h2 className="text-xl font-bold text-slate-900">Nova Reserva Manual</h2>
                    </div>
                    {process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.startsWith('TEST-') ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            MODO TESTE (SANDBOX)
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            MODO PRODUÇÃO
                        </Badge>
                    )}
                </div>
            </header>

            <div className="max-w-[800px] mx-auto px-6 mt-8">
                <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white p-8">
                        <CardTitle className="text-2xl font-extrabold flex items-center gap-3">
                            <Home className="w-6 h-6 text-slate-400" />
                            Detalhes da Reserva
                        </CardTitle>
                        <CardDescription className="text-slate-400 font-medium">
                            Preencha os dados abaixo para gerar a reserva no sistema e processar o pagamento.
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-10">
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-start gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Seção Hóspede */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-2 text-slate-900 mb-2">
                                    <User className="w-5 h-5 text-slate-400" />
                                    <h3 className="font-bold text-lg">Informações do Hóspede</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Nome Completo</Label>
                                        <div className="relative">
                                            <Input
                                                required
                                                name="guestName"
                                                value={formData.guestName}
                                                onChange={handleChange}
                                                disabled={Boolean(paymentBookingId)}
                                                className="pl-4 h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                                                placeholder="Ex: João da Silva"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider flex items-center gap-1">
                                                Email do Pagador
                                                <Mail className="w-3 h-3 text-slate-400" />
                                            </Label>
                                            <Input
                                                required
                                                type="email"
                                                name="guestEmail"
                                                value={formData.guestEmail}
                                                onChange={handleChange}
                                                disabled={Boolean(paymentBookingId)}
                                                className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                                                placeholder="email@exemplo.com"
                                            />
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                O comprovante será enviado para este e-mail.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider flex items-center gap-1">
                                                Telefone de Contato
                                                <Phone className="w-3 h-3 text-slate-400" />
                                            </Label>
                                            <Input
                                                type="tel"
                                                name="guestPhone"
                                                value={formData.guestPhone}
                                                onChange={handleChange}
                                                disabled={Boolean(paymentBookingId)}
                                                className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                                                placeholder="(00) 00000-0000"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="h-px bg-slate-100" />

                            {/* Seção Estadia */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-2 text-slate-900 mb-2">
                                    <Calendar className="w-5 h-5 text-slate-400" />
                                    <h3 className="font-bold text-lg">Detalhes da Estadia</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Data de Check-in</Label>
                                        <Input
                                            required
                                            type="date"
                                            name="checkIn"
                                            value={formData.checkIn}
                                            onChange={handleChange}
                                            disabled={Boolean(paymentBookingId)}
                                            className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl appearance-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Data de Check-out</Label>
                                        <Input
                                            required
                                            type="date"
                                            name="checkOut"
                                            value={formData.checkOut}
                                            onChange={handleChange}
                                            disabled={Boolean(paymentBookingId)}
                                            className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Tipo de Acomodação</Label>
                                    <Select 
                                        disabled={Boolean(paymentBookingId)}
                                        value={formData.roomTypeId}
                                        onValueChange={(val) => setFormData(p => ({...p, roomTypeId: val}))}
                                    >
                                        <SelectTrigger className="h-12 bg-slate-50/50 border-slate-200 focus:ring-slate-400 rounded-xl">
                                            <SelectValue placeholder="Selecione o quarto" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200">
                                            {roomTypes.map(room => (
                                                <SelectItem key={room.id} value={room.id} className="cursor-pointer">
                                                    {room.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider flex items-center gap-1">
                                            Adultos
                                            <Users className="w-3 h-3 text-slate-400" />
                                        </Label>
                                        <Input
                                            required
                                            type="number"
                                            min="1"
                                            name="adults"
                                            value={formData.adults}
                                            onChange={handleChange}
                                            disabled={Boolean(paymentBookingId)}
                                            className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl text-center font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider flex items-center gap-1">
                                            Crianças
                                        </Label>
                                        <Input
                                            required
                                            type="number"
                                            min="0"
                                            name="children"
                                            value={formData.children}
                                            onChange={handleChange}
                                            disabled={Boolean(paymentBookingId)}
                                            className="h-12 bg-slate-50/50 border-slate-200 focus:bg-white transition-all rounded-xl text-center font-bold"
                                        />
                                    </div>
                                </div>
                            </section>

                            <div className="h-px bg-slate-100" />

                            {/* Seção Financeira */}
                            <section className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                                <div className="flex items-center gap-2 text-slate-900">
                                    <CreditCard className="w-5 h-5 text-slate-400" />
                                    <h3 className="font-bold text-lg">Financeiro</h3>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-600 font-semibold text-xs uppercase tracking-wider">Valor Total (R$)</Label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-emerald-600/50">R$</span>
                                        <Input
                                            required
                                            type="number"
                                            step="0.01"
                                            min="1"
                                            name="totalPrice"
                                            value={formData.totalPrice}
                                            onChange={handleChange}
                                            disabled={Boolean(paymentBookingId)}
                                            className="h-16 pl-14 text-3xl font-black text-emerald-700 bg-white border-slate-200 focus:ring-emerald-500 rounded-xl"
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium italic">Este valor será cobrado no checkout do Mercado Pago.</p>
                                </div>
                            </section>

                            <div className="pt-8 flex flex-col md:flex-row gap-4 items-center justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => router.back()}
                                    className="px-8 h-12 font-bold text-slate-500 hover:text-slate-900 transition-colors"
                                >
                                    Descartar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading || Boolean(paymentBookingId)}
                                    className={cn(
                                        "px-10 h-12 rounded-xl font-bold text-base shadow-lg transition-all gap-2",
                                        paymentBookingId ? "bg-emerald-600 hover:bg-emerald-600" : "bg-slate-900 hover:bg-slate-800"
                                    )}
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : paymentBookingId ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : (
                                        <ArrowRight className="w-5 h-5" />
                                    )}
                                    {paymentBookingId ? 'Reserva Criada' : loading ? 'Processando...' : 'Gerar Reserva e Pagar'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Seção de Pagamento */}
                {paymentBookingId && (
                    <Card className="mt-12 border-2 border-slate-900 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-500" id={paymentSectionId}>
                        <CardHeader className="bg-slate-900 text-white p-8">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-2xl font-black flex items-center gap-3">
                                    <CreditCard className="w-7 h-7 text-emerald-400" />
                                    Pagamento da Reserva
                                </CardTitle>
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold px-3 py-1">
                                    PENDENTE
                                </Badge>
                            </div>
                            <CardDescription className="text-slate-400 mt-2 font-medium">
                                Conclua a transação abaixo para confirmar a reserva #{paymentBookingId}.
                            </CardDescription>
                        </CardHeader>
                        
                        <CardContent className="p-8 space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor a Pagar</p>
                                    <p className="text-3xl font-black text-slate-900">R$ {Number(paymentAmount || 0).toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reserva</p>
                                    <p className="font-mono text-slate-600 font-bold">#{paymentBookingId}</p>
                                </div>
                            </div>

                            {paymentError && (
                                <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-3 text-sm font-bold">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    {paymentError}
                                </div>
                            )}

                            {paymentStatusMessage && (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-center gap-3 text-sm font-bold">
                                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                                    {paymentStatusMessage}
                                </div>
                            )}

                            {paymentStatus === 'pending' && pixData?.qr_code_base64 && (
                                <div className="flex flex-col items-center gap-6 p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <img
                                            src={`data:image/png;base64,${pixData.qr_code_base64}`}
                                            alt="QR Code Pix"
                                            className="w-48 h-48"
                                        />
                                    </div>
                                    <div className="w-full space-y-3">
                                        <p className="text-center text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-2">
                                            <QrCode className="w-4 h-4" />
                                            Código Copia e Cola
                                        </p>
                                        <textarea
                                            readOnly
                                            value={pixData.qr_code}
                                            className="w-full h-24 rounded-xl border border-slate-200 bg-white p-4 text-xs font-mono text-slate-500 focus:ring-0 resize-none shadow-inner"
                                            rows={4}
                                        />
                                        <Button 
                                            variant="outline" 
                                            className="w-full h-12 rounded-xl font-bold gap-2"
                                            onClick={() => {
                                                navigator.clipboard.writeText(pixData.qr_code || '');
                                                alert('Código copiado!');
                                            }}
                                        >
                                            Copiar Código Pix
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div id={paymentContainerId} className="min-h-[300px] flex items-center justify-center">
                                {!paymentStatusMessage && !paymentError && (
                                    <div className="flex flex-col items-center gap-4 text-slate-400">
                                        <Loader2 className="w-10 h-10 animate-spin" />
                                        <p className="font-bold text-sm uppercase tracking-widest">Carregando Mercado Pago...</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        
                        <CardFooter className="bg-slate-50 border-t border-slate-100 p-6 flex justify-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center max-w-[400px]">
                                Ambiente seguro e criptografado processado por <span className="text-blue-500">Mercado Pago</span>
                            </p>
                        </CardFooter>
                    </Card>
                )}
            </div>
        </div>
    );
}
