'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    BadgeCheck,
    CalendarCheck2,
    CalendarClock,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Coffee,
    CreditCard,
    Home,
    Mail,
    MapPinned,
    Phone,
    Receipt,
    ShieldCheck,
    UserRound,
    XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateBR } from '@/lib/date';
import { getLocalRoomPhotos } from '@/lib/room-photos';
import { trackPurchase } from '@/lib/analytics';

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
        dataLayer?: unknown[];
    }
}

type PaymentStatus = 'CONFIRMED' | 'CANCELLED' | 'PENDING';

interface BookingPhoto {
    url: string;
}

interface BookingData {
    id: string;
    status?: string | null;
    checkIn: string;
    checkOut: string;
    totalPrice: number | string;
    roomType?: {
        id?: string;
        name?: string | null;
        photos?: BookingPhoto[];
    } | null;
    guest?: {
        name?: string | null;
    } | null;
    payment?: {
        status?: string | null;
        method?: string | null;
        cardBrand?: string | null;
        installments?: number | null;
    } | null;
}

const PAYMENT_REJECTED_STATUSES = ['REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK'];

function trackPurchaseOnce(booking: BookingData | null) {
    if (typeof window === 'undefined') return;
    if (!booking?.id) return;

    const bookingStatus = String(booking?.status || '').toUpperCase();
    const paymentStatus = String(booking?.payment?.status || '').toUpperCase();
    const approved = bookingStatus === 'CONFIRMED' || paymentStatus === 'APPROVED';
    if (!approved) return;

    const storageKey = `purchase_sent_${booking.id}`;
    if (window.localStorage.getItem(storageKey)) return;

    const value = Number(booking?.totalPrice || 0);
    const items = [
        {
            item_id: String(booking?.roomType?.id || 'quarto'),
            item_name: String(booking?.roomType?.name || 'Hospedagem'),
            quantity: 1,
            price: Number.isFinite(value) ? value : 0,
        },
    ];

    const hasAnalyticsQueue = typeof window.gtag === 'function' || Array.isArray(window.dataLayer);
    if (!hasAnalyticsQueue) return;

    trackPurchase({
        transactionId: String(booking.id),
        value: Number.isFinite(value) ? value : 0,
        currency: 'BRL',
        items,
    });

    window.localStorage.setItem(storageKey, new Date().toISOString());
}

function getEffectiveStatus(booking: BookingData | null): PaymentStatus {
    const bookingStatus = String(booking?.status || '').toUpperCase();
    const paymentStatus = String(booking?.payment?.status || '').toUpperCase();

    if (bookingStatus === 'CONFIRMED' || paymentStatus === 'APPROVED') return 'CONFIRMED';
    if (bookingStatus === 'CANCELLED' || PAYMENT_REJECTED_STATUSES.includes(paymentStatus)) return 'CANCELLED';
    return 'PENDING';
}

function formatCurrency(value: number | string | null | undefined) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number.isFinite(amount) ? amount : 0);
}

function formatPaymentMethod(payment?: BookingData['payment']) {
    const method = String(payment?.method || '').toUpperCase();
    const brand = String(payment?.cardBrand || '').trim().toUpperCase();
    const installments = Number(payment?.installments || 0);

    if (method === 'PIX') return 'Pix';
    if (method === 'DEBIT_CARD') return brand ? `Cartao de debito ${brand}` : 'Cartao de debito';
    if (method === 'CREDIT_CARD') {
        if (brand && installments > 1) return `Cartao de credito ${brand} em ${installments}x`;
        if (brand) return `Cartao de credito ${brand}`;
        if (installments > 1) return `Cartao de credito em ${installments}x`;
        return 'Cartao de credito';
    }

    if (method) return method.replaceAll('_', ' ');
    return 'Aguardando confirmacao';
}

function formatPaymentStatus(status?: string | null) {
    const normalized = String(status || '').toUpperCase();

    if (normalized === 'APPROVED') return 'Aprovado';
    if (normalized === 'PENDING') return 'Pendente';
    if (normalized === 'REJECTED') return 'Recusado';
    if (normalized === 'CANCELLED') return 'Cancelado';
    if (normalized === 'REFUNDED') return 'Estornado';
    if (normalized === 'CHARGED_BACK') return 'Chargeback';
    return normalized || 'Em analise';
}

function getStatusPresentation(status: PaymentStatus) {
    if (status === 'CONFIRMED') {
        return {
            title: 'Pagamento aprovado!',
            subtitle: 'Sua reserva esta confirmada e pronta para a sua chegada.',
            banner: 'Em instantes voce recebera a confirmacao com os detalhes da hospedagem.',
            accent: 'text-primary',
            border: 'border-primary/10',
            surface: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,244,234,0.88))]',
            iconWrap: 'border-primary/20 bg-secondary/12 text-primary',
            badgeClass: 'border-primary/15 bg-primary text-white',
            statusLabel: 'Confirmada',
        };
    }

    if (status === 'CANCELLED') {
        return {
            title: 'Pagamento nao aprovado',
            subtitle: 'Nao conseguimos confirmar a transacao desta reserva.',
            banner: 'Se precisar, nossa equipe pode ajudar voce a tentar novamente pelo atendimento direto.',
            accent: 'text-[#8A2F2A]',
            border: 'border-[#8A2F2A]/15',
            surface: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,236,232,0.92))]',
            iconWrap: 'border-[#8A2F2A]/20 bg-[#8A2F2A]/8 text-[#8A2F2A]',
            badgeClass: 'border-[#8A2F2A]/15 bg-[#8A2F2A] text-white',
            statusLabel: 'Nao confirmada',
        };
    }

    return {
        title: 'Pagamento em processamento',
        subtitle: 'Estamos aguardando a confirmacao final da transacao.',
        banner: 'Esta pagina atualiza automaticamente para refletir o status mais recente do pagamento.',
        accent: 'text-primary',
        border: 'border-secondary/25',
        surface: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,245,0.98))]',
        iconWrap: 'border-secondary/30 bg-secondary/12 text-primary',
        badgeClass: 'border-secondary/20 bg-secondary/85 text-secondary-foreground',
        statusLabel: 'Em processamento',
    };
}

function getRoomImage(booking: BookingData | null) {
    const backendPhoto = booking?.roomType?.photos?.[0]?.url;
    if (backendPhoto) return backendPhoto;

    const roomName = String(booking?.roomType?.name || '');
    return getLocalRoomPhotos(roomName)?.[0] || null;
}

function getStayNights(checkIn?: string, checkOut?: string) {
    if (!checkIn || !checkOut) return 0;

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    if (!Number.isFinite(diff) || diff <= 0) return 0;

    return Math.round(diff / (1000 * 60 * 60 * 24));
}

function StatusIcon({ status }: { status: PaymentStatus }) {
    if (status === 'CONFIRMED') return <CheckCircle2 className="h-7 w-7" />;
    if (status === 'CANCELLED') return <XCircle className="h-7 w-7" />;
    return <Clock3 className="h-7 w-7" />;
}

export default function ConfirmacaoPage() {
    const params = useParams();
    const router = useRouter();
    const bookingId = params.bookingId as string;

    const [booking, setBooking] = useState<BookingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(false);
    const [statusToast, setStatusToast] = useState('');
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const lastStatusRef = useRef<PaymentStatus | null>(null);

    const fetchBooking = useCallback(async () => {
        if (!bookingId) return;

        try {
            const response = await fetch(`/api/bookings/${bookingId}`);
            if (!response.ok) return;

            const data = (await response.json()) as BookingData;
            setBooking(data);

            const effectiveStatus = getEffectiveStatus(data);
            const previousStatus = lastStatusRef.current;
            lastStatusRef.current = effectiveStatus;

            if (effectiveStatus === 'CONFIRMED') {
                setPolling(false);
                if (pollRef.current) clearInterval(pollRef.current);
                if (previousStatus && previousStatus !== 'CONFIRMED') {
                    setStatusToast('Pagamento aprovado e reserva confirmada.');
                    setTimeout(() => setStatusToast(''), 3000);
                }
                return;
            }

            if (effectiveStatus === 'CANCELLED') {
                setPolling(false);
                if (pollRef.current) clearInterval(pollRef.current);
                if (previousStatus && previousStatus !== 'CANCELLED') {
                    setStatusToast('Pagamento recusado. Fale com a pousada para suporte.');
                    setTimeout(() => setStatusToast(''), 3000);
                }
                return;
            }

            setPolling(true);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [bookingId]);

    useEffect(() => {
        const initialFetchTimeout = window.setTimeout(() => {
            void fetchBooking();
        }, 0);

        if (!pollRef.current) {
            pollRef.current = setInterval(() => {
                void fetchBooking();
            }, 10000);
        }

        return () => {
            window.clearTimeout(initialFetchTimeout);
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchBooking]);

    useEffect(() => {
        trackPurchaseOnce(booking);
    }, [booking]);

    if (loading) {
        return (
            <main className="min-h-screen bg-background px-4 pb-20 pt-32 text-center text-primary md:px-6">
                <div className="mx-auto flex max-w-xl flex-col items-center border border-primary/10 bg-white px-8 py-12">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-none border border-primary/15 bg-[color:var(--brand-cream)]">
                        <Clock3 className="h-7 w-7 animate-pulse text-primary" />
                    </div>
                    <h1 className="text-2xl font-semibold text-primary">Sincronizando sua reserva</h1>
                    <p className="mt-3 max-w-md text-sm leading-7 text-primary/72">
                        Estamos atualizando o status mais recente do pagamento para mostrar a confirmacao correta.
                    </p>
                </div>
            </main>
        );
    }

    const effectiveStatus = getEffectiveStatus(booking);
    const statusView = getStatusPresentation(effectiveStatus);
    const roomImage = getRoomImage(booking);
    const stayNights = getStayNights(booking?.checkIn, booking?.checkOut);
    const paymentStatusLabel = formatPaymentStatus(booking?.payment?.status);
    const paymentMethodLabel = formatPaymentMethod(booking?.payment);

    return (
        <main className="min-h-screen bg-background px-4 pb-14 pt-28 text-primary md:px-6 md:pt-32">
            <div className="mx-auto max-w-6xl">
                <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,rgba(187,184,99,0.18),transparent_58%)]" />

                <section className={`overflow-hidden border ${statusView.border} ${statusView.surface}`}>
                    <div className="border-b border-primary/10 px-6 py-8 md:px-10 md:py-10">
                        {statusToast ? (
                            <div className="mb-6 inline-flex border border-primary/10 bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                                {statusToast}
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`flex h-16 w-16 shrink-0 items-center justify-center border ${statusView.iconWrap}`}>
                                    <StatusIcon status={effectiveStatus} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/58">
                                        Confirmacao da reserva
                                    </p>
                                    <h1 className={`mt-2 text-3xl font-semibold leading-tight md:text-[2.7rem] ${statusView.accent}`}>
                                        {statusView.title}
                                    </h1>
                                    <p className="mt-3 max-w-2xl text-base leading-7 text-primary/76">
                                        {statusView.subtitle}
                                    </p>
                                </div>
                            </div>

                            <Badge className={`rounded-none px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${statusView.badgeClass}`}>
                                {statusView.statusLabel}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid gap-6 px-6 py-6 md:px-10 md:py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
                        <div className="space-y-6">
                            <section className="border border-primary/10 bg-white">
                                <div className="border-b border-primary/10 bg-[color:var(--brand-cream)] px-5 py-4 md:px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center border border-primary/10 bg-white text-primary">
                                            <CalendarCheck2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/58">
                                                Sua reserva
                                            </p>
                                            <h2 className="text-2xl font-semibold text-primary">Detalhes da hospedagem</h2>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-5 py-4 md:px-6 md:py-5">
                                    <div className="grid gap-4">
                                        <div className="flex items-center justify-between gap-4 border-b border-primary/10 pb-4">
                                            <div className="flex items-center gap-3 text-primary/78">
                                                <Home className="h-4.5 w-4.5 shrink-0" />
                                                <span className="text-sm font-medium">Quarto</span>
                                            </div>
                                            <span className="text-right text-sm font-semibold text-primary">
                                                {booking?.roomType?.name || 'Acomodacao selecionada'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 border-b border-primary/10 pb-4">
                                            <div className="flex items-center gap-3 text-primary/78">
                                                <UserRound className="h-4.5 w-4.5 shrink-0" />
                                                <span className="text-sm font-medium">Hospede</span>
                                            </div>
                                            <span className="text-right text-sm font-semibold uppercase text-primary">
                                                {booking?.guest?.name || 'Nao informado'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 border-b border-primary/10 pb-4">
                                            <div className="flex items-center gap-3 text-primary/78">
                                                <CalendarDays className="h-4.5 w-4.5 shrink-0" />
                                                <span className="text-sm font-medium">Check-in</span>
                                            </div>
                                            <span className="text-right text-sm font-semibold text-primary">
                                                {booking?.checkIn ? formatDateBR(booking.checkIn) : '-'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 border-b border-primary/10 pb-4">
                                            <div className="flex items-center gap-3 text-primary/78">
                                                <CalendarClock className="h-4.5 w-4.5 shrink-0" />
                                                <span className="text-sm font-medium">Check-out</span>
                                            </div>
                                            <span className="text-right text-sm font-semibold text-primary">
                                                {booking?.checkOut ? formatDateBR(booking.checkOut) : '-'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 border-b border-primary/10 pb-4">
                                            <div className="flex items-center gap-3 text-primary/78">
                                                <Receipt className="h-4.5 w-4.5 shrink-0" />
                                                <span className="text-sm font-medium">Diarias</span>
                                            </div>
                                            <span className="text-right text-sm font-semibold text-primary">
                                                {stayNights} {stayNights === 1 ? 'diaria' : 'diarias'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4 pt-1">
                                            <div className="flex items-center gap-3 text-primary/78">
                                                <BadgeCheck className="h-4.5 w-4.5 shrink-0" />
                                                <span className="text-sm font-medium">Total</span>
                                            </div>
                                            <span className="text-right text-[1.95rem] font-semibold leading-none text-primary">
                                                {formatCurrency(booking?.totalPrice)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid gap-3 border-t border-primary/10 pt-6">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-primary/78">Status da reserva</span>
                                            <Badge className={`rounded-none px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] ${statusView.badgeClass}`}>
                                                {effectiveStatus === 'CONFIRMED' ? 'Confirmada' : effectiveStatus === 'CANCELLED' ? 'Cancelada' : 'Pendente'}
                                            </Badge>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-primary/78">Metodo de pagamento</span>
                                            <span className="text-right text-sm font-medium text-primary">
                                                {paymentMethodLabel}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-primary/78">Status do pagamento</span>
                                            <span className="text-right text-sm font-medium text-primary">
                                                {paymentStatusLabel}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className={`border px-5 py-5 md:px-6 ${statusView.border} ${effectiveStatus === 'CONFIRMED' ? 'bg-secondary/8' : effectiveStatus === 'CANCELLED' ? 'bg-[#8A2F2A]/6' : 'bg-[color:var(--brand-cream)]'}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center border ${statusView.iconWrap}`}>
                                        <StatusIcon status={effectiveStatus} />
                                    </div>
                                    <div>
                                        <h3 className={`text-xl font-semibold ${statusView.accent}`}>
                                            {effectiveStatus === 'CONFIRMED'
                                                ? 'Pagamento aprovado'
                                                : effectiveStatus === 'CANCELLED'
                                                    ? 'Pagamento nao confirmado'
                                                    : 'Atualizacao em andamento'}
                                        </h3>
                                        <p className="mt-2 text-sm leading-7 text-primary/78">
                                            {statusView.banner}
                                        </p>
                                        {polling && effectiveStatus === 'PENDING' ? (
                                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary/60">
                                                Atualizacao automatica a cada 10 segundos
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-center pt-1">
                                <Button
                                    type="button"
                                    onClick={() => router.push('/')}
                                    className="h-14 rounded-none px-10 text-sm font-semibold uppercase tracking-[0.14em] shadow-none"
                                >
                                    <Home className="h-4 w-4" />
                                    Voltar ao inicio
                                </Button>
                            </div>
                        </div>

                        <aside className="space-y-6">
                            <section className="overflow-hidden border border-primary/10 bg-white">
                                <div className="relative aspect-[4/3] bg-[color:var(--brand-cream)]">
                                    {roomImage ? (
                                        <Image
                                            src={roomImage}
                                            alt={booking?.roomType?.name || 'Acomodacao reservada'}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 1024px) 100vw, 33vw"
                                        />
                                    ) : null}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(9,9,9,0.55)] via-transparent to-transparent" />
                                    <div className="absolute inset-x-0 bottom-0 p-5">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/78">
                                            Sua acomodacao
                                        </p>
                                        <p className="mt-2 text-2xl font-semibold text-white">
                                            {booking?.roomType?.name || 'Reserva Delplata'}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="border border-primary/10 bg-white">
                                <div className="border-b border-primary/10 bg-[color:var(--brand-cream)] px-5 py-4">
                                    <h3 className="text-xl font-semibold text-primary">Proximos passos</h3>
                                </div>
                                <div className="space-y-4 px-5 py-5 text-sm leading-7 text-primary/78">
                                    <div className="flex items-start gap-3">
                                        <Mail className="mt-1 h-4.5 w-4.5 shrink-0 text-primary" />
                                        <p>Voce recebera um e-mail com os detalhes da sua reserva.</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <ShieldCheck className="mt-1 h-4.5 w-4.5 shrink-0 text-primary" />
                                        <p>Apresente um documento com foto no check-in.</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Clock3 className="mt-1 h-4.5 w-4.5 shrink-0 text-primary" />
                                        <p>Check-in a partir das 14h e check-out ate as 12h.</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Coffee className="mt-1 h-4.5 w-4.5 shrink-0 text-primary" />
                                        <p>Cafe da manha incluso durante a sua diaria.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="border border-primary/10 bg-white">
                                <div className="border-b border-primary/10 bg-[color:var(--brand-cream)] px-5 py-4">
                                    <h3 className="text-xl font-semibold text-primary">Precisa de ajuda?</h3>
                                </div>
                                <div className="space-y-4 px-5 py-5 text-sm leading-7 text-primary/78">
                                    <p>Nossa equipe esta a disposicao para qualquer ajuste ou duvida sobre a reserva.</p>
                                    <div className="flex items-start gap-3">
                                        <Phone className="mt-1 h-4.5 w-4.5 shrink-0 text-primary" />
                                        <p>WhatsApp: (19) 99965-4866</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Mail className="mt-1 h-4.5 w-4.5 shrink-0 text-primary" />
                                        <p>E-mail: contato@pousadadelplata.com.br</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <MapPinned className="mt-1 h-4.5 w-4.5 shrink-0 text-primary" />
                                        <p>Atendimento direto da pousada, sem intermediarios.</p>
                                    </div>
                                </div>
                            </section>
                        </aside>
                    </div>

                    <div className="border-t border-primary/10 bg-white px-6 py-5 md:px-10">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="flex items-center gap-3 border border-primary/10 bg-[color:var(--brand-cream)] px-4 py-4">
                                <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                                <div>
                                    <p className="text-sm font-semibold text-primary">Reserva 100% segura</p>
                                    <p className="text-xs text-primary/68">Seus dados protegidos</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 border border-primary/10 bg-[color:var(--brand-cream)] px-4 py-4">
                                <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                                <div>
                                    <p className="text-sm font-semibold text-primary">Melhor tarifa garantida</p>
                                    <p className="text-xs text-primary/68">Reservando direto conosco</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 border border-primary/10 bg-[color:var(--brand-cream)] px-4 py-4">
                                <Coffee className="h-5 w-5 shrink-0 text-primary" />
                                <div>
                                    <p className="text-sm font-semibold text-primary">Cafe da manha incluso</p>
                                    <p className="text-xs text-primary/68">Em todas as diarias</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 border border-primary/10 bg-[color:var(--brand-cream)] px-4 py-4">
                                <CreditCard className="h-5 w-5 shrink-0 text-primary" />
                                <div>
                                    <p className="text-sm font-semibold text-primary">Atendimento direto</p>
                                    <p className="text-xs text-primary/68">Suporte rapido quando precisar</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
