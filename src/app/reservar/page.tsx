'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState, Suspense, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SearchWidget from '@/components/SearchWidget';

import { Check, AlertCircle, Calendar, ArrowLeft, CreditCard, User, Mail, Phone, Camera } from 'lucide-react';
import { getLocalRoomPhotos } from '@/lib/room-photos';
import { formatDateBR, formatDateBRFromYmd } from '@/lib/date';
 

interface Room {
    id: string;
    name: string;
    description: string;
    capacity: number;
    amenities: string;
    totalPrice: number;
    minLos?: number;
    priceBreakdown?: {
        nights: number;
        baseTotal: number;
        effectiveAdults: number;
        childrenUnder12: number;
        extraAdults: number;
        children6To11: number;
        extrasPerNight: number;
        extraAdultTotal: number;
        childTotal: number;
        total: number;
    };
    photos: { url: string }[];
}

interface Guest {
    name: string;
    email: string;
    phone: string;
}

interface AppliedCoupon {
    reservationId: string;
    code: string;
    discountAmount: number;
    subtotal: number;
    total: number;
    expiresAt?: string;
}

function ReservarContent() {
    const searchParams = useSearchParams();
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults') || '2';
    const children = searchParams.get('children') || '0';
    const childrenAgesParam = searchParams.get('childrenAges') || '';

    // Memoize childrenAges to prevent array recreation on every render
    const childrenAges = useMemo(() => {
        return childrenAgesParam.trim().length > 0
            ? childrenAgesParam.split(',').map((s) => Number.parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n))
            : [];
    }, [childrenAgesParam]);

    // Create stable string key for childrenAges (childrenAgesParam is already stable)
    const childrenAgesKey = childrenAgesParam.trim();

    const [availableRooms, setAvailableRooms] = useState<Room[] | null>(null);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [guest, setGuest] = useState<Guest>({ name: '', email: '', phone: '' });
    const [couponCode, setCouponCode] = useState('');
    const [couponMessage, setCouponMessage] = useState('');
    const [couponApplying, setCouponApplying] = useState(false);
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
    const [formMessage, setFormMessage] = useState('');
    const [pendingCouponOverride, setPendingCouponOverride] = useState(false);
    const [loading, setLoading] = useState(true); // Start with true to show initial loading
    const [error, setError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
    const [paymentError, setPaymentError] = useState<string>('');
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'approved' | 'rejected' | 'pending' | 'error'>('idle');
    const [paymentStatusMessage, setPaymentStatusMessage] = useState<string>('');
    const [pixData, setPixData] = useState<{ qr_code?: string; qr_code_base64?: string; ticket_url?: string } | null>(null);
    const [pixCopied, setPixCopied] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const paymentBrickRef = useRef<any>(null);
    const paymentContainerId = 'paymentBrick_container';
    const mountedRef = useRef(true);
    const lastKeyRef = useRef<string>(''); // Track last request to avoid duplicates
    const hasLoadedOnce = useRef(false); // Track if we've completed at least one fetch
    const maxGuests = 3;
    const numAdults = Number.parseInt(adults, 10) || 0;
    const numChildren = Number.parseInt(children, 10) || 0;
    const totalGuests = numAdults + numChildren;
    const isOverCapacity = totalGuests > maxGuests;
    const isInvalidAdults = numAdults < 1;

    const isPlaceholderUrl = (url: string) => {
        const normalizedUrl = url.trim().toLowerCase();
        const placeholderDomains = [
            'picsum.photos',
            'unsplash.com',
            'images.unsplash.com',
            'source.unsplash.com',
            'via.placeholder.com',
            'placeholder.com',
            'placehold.co',
        ];

        return placeholderDomains.some((domain) => normalizedUrl.includes(domain));
    };

    const getRoomPrimaryImageSrc = (room: Room) => {
        const backendUrls = (room.photos ?? [])
            .map((p) => p?.url?.trim())
            .filter((url): url is string => Boolean(url))
            .filter((url) => !isPlaceholderUrl(url));

        if (backendUrls.length > 0) return backendUrls[0];

        const localPhotos = getLocalRoomPhotos(room.name);
        return localPhotos?.[0] ?? null;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return formatDateBRFromYmd(dateString);
    };

    const stayNights = useMemo(() => {
        if (!checkIn || !checkOut) return 0;
        const diff = Math.ceil(
            (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)
        );
        return Math.max(0, diff);
    }, [checkIn, checkOut]);

    const bookingSubtotal = selectedRoom ? Number(selectedRoom.totalPrice) : 0;
    const bookingDiscount = appliedCoupon ? Number(appliedCoupon.discountAmount || 0) : 0;
    const bookingTotal = Math.max(0, bookingSubtotal - bookingDiscount);
    const normalizedCouponInput = couponCode.trim().toUpperCase();
    const hasPendingCouponToApply = normalizedCouponInput.length > 0
        && (!appliedCoupon || appliedCoupon.code !== normalizedCouponInput);

    const getWhatsAppUrl = () => {
        const checkInStr = checkIn ? formatDate(checkIn) : 'DATA INDEFINIDA';
        const checkOutStr = checkOut ? formatDate(checkOut) : 'DATA INDEFINIDA';
        const message = `Olá! Gostaria de cotar hospedagem para *${numAdults} adultos* e *${numChildren} crianças*.\n` +
            `Datas: ${checkInStr} a ${checkOutStr}.\n` +
            `Nossas acomodações comportam até 3 pessoas por quarto. Para grupos maiores, fale com a gente no WhatsApp.`;
        const whatsappPhone = '5519999654866';
        return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
    };


    const fetchAvailability = useCallback(async (signal?: AbortSignal) => {
        if (!checkIn || !checkOut || isOverCapacity || isInvalidAdults) {
            // Early return for invalid inputs - ensure loading is false
            if (mountedRef.current) {
                setLoading(false);
                hasLoadedOnce.current = true;
            }
            return;
        }

        // Create stable request key for deduplication
        const requestKey = `${checkIn}|${checkOut}|${adults}|${children}|${childrenAgesKey}`;

        // Deduplicate: if same request already in flight or just completed, skip
        if (requestKey === lastKeyRef.current) {
            console.log('availability:skip-duplicate', { requestKey });
            // Still mark as loaded even if skipping
            if (mountedRef.current && !hasLoadedOnce.current) {
                setLoading(false);
                hasLoadedOnce.current = true;
            }
            return;
        }

        try {
            console.log('availability:start', { checkIn, checkOut, adults, children, childrenAges });

            // Clear previous results and start loading
            if (mountedRef.current) {
                setAvailableRooms(null);
                setLoading(true);
                setError('');
            }

            const childrenAgesQuery = childrenAges.length > 0 ? `&childrenAges=${encodeURIComponent(childrenAges.join(','))}` : '';
            const response = await fetch(
                `/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}${childrenAgesQuery}`,
                { cache: 'no-store', signal }
            );
            if (!response.ok) {
                const data = typeof response.json === 'function'
                    ? await response.json().catch(() => null)
                    : null;
                if (data && data.error === 'min_stay_required') {
                    throw new Error(`Para esta data, o mínimo de reservas é ${data.minLos} noite${Number(data.minLos) > 1 ? 's' : ''}.`);
                }
                throw new Error('Erro ao carregar quartos disponíveis');
            }
            const data = await response.json();

            // PRICING DIAGNOSTICS: Log price breakdown to verify children >= 12 are counted as adults
            // and extraAdultFee/child6To11Fee are applied (if configured in DB)
            console.log('availability:pricing-check', {
                rooms: data.map((room: Room) => ({
                    name: room.name,
                    totalPrice: room.totalPrice,
                    breakdown: room.priceBreakdown,
                    // If extraAdultFee/child6To11Fee are 0 in DB, totals will be same as base (expected)
                }))
            });

            if (mountedRef.current) {
                setAvailableRooms(data);
                hasLoadedOnce.current = true;
            }

            // Mark this request as completed ONLY after successful fetch
            // This prevents Strict Mode double-run from seeing it as duplicate before first completes
            lastKeyRef.current = requestKey;

            console.log('availability:finish ok', { count: Array.isArray(data) ? data.length : 0 });
        } catch (err: any) {
            if (err && err.name === 'AbortError') {
                console.log('availability:abort');
            } else {
                console.log('availability:error', err);
                if (mountedRef.current) {
                    setError(err instanceof Error ? err.message : 'Erro ao carregar quartos disponíveis. Tente novamente.');
                    hasLoadedOnce.current = true;
                }
            }
        } finally {
            if (mountedRef.current) setLoading(false);
            console.log('availability:finish', { loading: false });
        }
    }, [adults, checkIn, checkOut, children, childrenAgesKey, childrenAges, isInvalidAdults, isOverCapacity]);

    useEffect(() => {
        const controller = new AbortController();
        mountedRef.current = true;
        console.log('availability:effect-run');
        fetchAvailability(controller.signal);
        return () => {
            mountedRef.current = false;
            controller.abort();
            console.log('availability:effect-cleanup');
        };
    }, [fetchAvailability]);

    const releaseCouponReservation = useCallback(async (reservationId?: string) => {
        if (!reservationId) return;
        try {
            await fetch('/api/coupons/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationId,
                    guest: { email: guest.email },
                }),
            });
        } catch {
            // best-effort release
        }
    }, [guest.email]);

    const clearCouponState = useCallback((withRelease: boolean) => {
        if (withRelease && appliedCoupon?.reservationId) {
            void releaseCouponReservation(appliedCoupon.reservationId);
        }
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponMessage('');
        setPendingCouponOverride(false);
    }, [appliedCoupon?.reservationId, releaseCouponReservation]);

    const applyCoupon = async (): Promise<boolean> => {
        if (!selectedRoom) {
            setCouponMessage('Selecione um quarto antes de aplicar cupom.');
            return false;
        }

        const normalizedCode = couponCode.trim();
        if (!normalizedCode) {
            setCouponMessage('Informe um cupom para aplicar.');
            return false;
        }

        setCouponApplying(true);
        setCouponMessage('');
        setFormMessage('');
        setPendingCouponOverride(false);

        try {
            const response = await fetch('/api/coupons/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: normalizedCode,
                    guest: {
                        email: guest.email,
                        phone: guest.phone,
                    },
                    context: {
                        roomTypeId: selectedRoom.id,
                        source: 'direct',
                        subtotal: bookingSubtotal,
                    },
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data?.valid) {
                const reason = String(data?.reason || data?.error || 'INVALID_CODE');
                const reasonMessage = reason === 'MIN_BOOKING_NOT_REACHED'
                    ? 'Cupom indisponivel: valor minimo da reserva nao atingido.'
                    : reason === 'EXPIRED'
                        ? 'Este cupom expirou.'
                        : reason === 'NOT_STARTED'
                            ? 'Este cupom ainda nao esta ativo.'
                            : reason === 'GUEST_NOT_ELIGIBLE'
                                ? 'Este cupom nao e valido para este hospede.'
                                : reason === 'USAGE_LIMIT_REACHED' || reason === 'GUEST_USAGE_LIMIT_REACHED'
                                    ? 'Limite de uso deste cupom foi atingido.'
                                    : 'Cupom invalido ou indisponivel.';

                setAppliedCoupon(null);
                setCouponMessage(reasonMessage);
                return false;
            }

            if (appliedCoupon?.reservationId && appliedCoupon.reservationId !== data.reservationId) {
                void releaseCouponReservation(appliedCoupon.reservationId);
            }

            const discountAmount = Number(data?.discountAmount || 0);
            const subtotal = Number(data?.subtotal || bookingSubtotal);
            const total = Number(data?.total || Math.max(0, subtotal - discountAmount));

            setAppliedCoupon({
                reservationId: String(data.reservationId),
                code: normalizedCode.toUpperCase(),
                discountAmount,
                subtotal,
                total,
                expiresAt: data?.reservationExpiresAt ? String(data.reservationExpiresAt) : undefined,
            });
            setCouponCode(normalizedCode.toUpperCase());
            setCouponMessage('Cupom aplicado com sucesso.');
            setFormMessage('');
            setPendingCouponOverride(false);
            return true;
        } catch {
            setCouponMessage('Nao foi possivel validar o cupom. Tente novamente.');
            setPendingCouponOverride(false);
            return false;
        } finally {
            setCouponApplying(false);
        }
    };

    useEffect(() => {
        return () => {
            if (appliedCoupon?.reservationId) {
                void releaseCouponReservation(appliedCoupon.reservationId);
            }
        };
    }, [appliedCoupon?.reservationId, releaseCouponReservation]);

    const handleSelectRoom = (room: Room) => {
        if (selectedRoom?.id && selectedRoom.id !== room.id) {
            clearCouponState(true);
        }
        setFormMessage('');
        setSelectedRoom(room);
        setTimeout(() => {
            document.getElementById('guest-form')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormMessage('');

        if (!selectedRoom) {
            setFormMessage('Por favor, selecione um quarto.');
            return;
        }

        if (!termsAccepted) {
            setFormMessage('Por favor, aceite os termos e condições.');
            return;
        }

        if (hasPendingCouponToApply && !pendingCouponOverride) {
            setFormMessage('Voce digitou um cupom, mas ainda nao aplicou. Clique em "Aplicar" para validar ou clique novamente em "Ir para Pagamento Seguro" para continuar sem desconto.');
            setPendingCouponOverride(true);
            return;
        }

        try {
            setProcessing(true);
            setFormMessage('');

            const bookingResponse = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomTypeId: selectedRoom.id,
                    checkIn,
                    checkOut,
                    adults: Number.parseInt(adults, 10) || 0,
                    children: Number.parseInt(children, 10) || 0,
                    childrenAges,
                    totalPrice: bookingTotal,
                    guest,
                    coupon: appliedCoupon ? {
                        reservationId: appliedCoupon.reservationId,
                        code: appliedCoupon.code,
                    } : undefined,
                }),
            });

            if (!bookingResponse.ok) {
                const errorData = await bookingResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao criar reserva');
            }

            const booking = await bookingResponse.json();
            setPaymentBookingId(booking.id);
            setPaymentAmount(Number(booking.totalPrice));
            setPaymentError('');
            setPaymentStatus('idle');
            setPaymentStatusMessage('');
            setPixData(null);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao processar reserva. Tente novamente.';
            const couponErrorMessage = message === 'coupon_reservation_expired'
                ? 'Seu cupom expirou. Aplique novamente para recalcular o desconto.'
                : message === 'coupon_reservation_not_found'
                    ? 'Nao encontramos essa validacao de cupom. Aplique o cupom novamente.'
                    : message === 'coupon_reservation_unavailable' || message === 'coupon_reservation_conflict'
                        ? 'Este cupom nao esta mais disponivel para esta reserva.'
                        : message === 'coupon_guest_mismatch'
                            ? 'Este cupom e valido para outro hospede.'
                            : message === 'coupon_code_mismatch'
                                ? 'Codigo de cupom nao confere com a validacao anterior.'
                                : '';

            if (couponErrorMessage) {
                setCouponMessage(couponErrorMessage);
                setPendingCouponOverride(false);
                setFormMessage('Revise o cupom antes de continuar.');
            } else {
                setFormMessage(message);
            }
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        if (!paymentBookingId || !paymentAmount) return;

        let cancelled = false;
        const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
        if (!publicKey) {
            setPaymentError('Chave pública do Mercado Pago não configurada.');
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
                            email: guest.email,
                        },
                    },
                    customization: {
                        paymentMethods: {
                            creditCard: 'all',
                            debitCard: 'all',
                            pix: 'all',
                            bankTransfer: 'all',
                        },
                    },
                    callbacks: {
                        onReady: () => {
                            // Brick pronto
                        },
                        onSubmit: ({ formData }: any) => {
                            return fetch('/api/mercadopago/payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    ...formData,
                                    bookingId: paymentBookingId,
                                    description: `Reserva ${paymentBookingId}`,
                                    transaction_amount: paymentAmount,
                                }),
                            }).then(async (res) => {
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                    const msg = data?.message || data?.error || 'Erro ao processar pagamento';
                                    setPaymentStatus('error');
                                    setPaymentStatusMessage(msg);
                                    throw new Error(msg);
                                }

                                const status = data?.status;
                                const pix = data?.pix;
                                if (pix) setPixData(pix);
                                if (status === 'approved') {
                                    setPaymentStatus('approved');
                                    setPaymentStatusMessage('Pagamento aprovado! Redirecionando...');
                                    window.location.href = `/reservar/confirmacao/${paymentBookingId}`;
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
                                    setPaymentStatusMessage('Pagamento em análise. Você verá a confirmação em breve.');
                                }
                            });
                        },
                        onError: (err: any) => {
                            console.error('Mercado Pago Brick Error:', err);
                            setPaymentStatus('error');
                            setPaymentError('Erro no pagamento. Tente novamente.');
                        },
                    },
                });
            } catch (err) {
                console.error(err);
                setPaymentError('Não foi possível inicializar o pagamento.');
            }
        };

        initBrick();
        return () => {
            cancelled = true;
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [guest.email, paymentAmount, paymentBookingId]);

    useEffect(() => {
        if (!paymentBookingId) return;
        if (pollRef.current) return;

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/bookings/${paymentBookingId}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data?.status === 'CONFIRMED') {
                    setPaymentStatus('approved');
                    setPaymentStatusMessage('Pagamento aprovado! Redirecionando...');
                    if (pollRef.current) clearInterval(pollRef.current);
                    window.location.href = `/reservar/confirmacao/${paymentBookingId}`;
                } else if (data?.status === 'CANCELLED') {
                    setPaymentStatus('rejected');
                    setPaymentStatusMessage('Pagamento recusado. Tente novamente.');
                    if (pollRef.current) clearInterval(pollRef.current);
                }
            } catch {
                // ignora falhas de rede temporárias
            }
        }, 10000);
    }, [paymentBookingId]);

    if (!checkIn || !checkOut) {
        return (
            <main className="min-h-screen relative flex items-center justify-center">
                {/* Background Image */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/fotos/piscina-aptos/DJI_0845.jpg"
                        alt="Background"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
                </div>

                <div className="container relative z-10 max-w-4xl mx-auto px-4">
                    <div className="text-center mb-8 text-white">
                        <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4 drop-shadow-lg">
                            Planeje sua Estadia
                        </h1>
                        <p className="text-lg md:text-xl text-white/90 font-light drop-shadow-md max-w-2xl mx-auto">
                            Selecione as datas da sua viagem para conferir nossas acomodações exclusivas e garantir o melhor preço.
                        </p>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-2xl border border-white/20">
                        <SearchWidget variant="light" />
                    </div>
                </div>
            </main>
        );
    }

    if (isInvalidAdults) {
        return (
            <main className="min-h-screen pt-32 container text-center bg-muted/30">
                <div className="bg-amber-50 text-amber-900 p-6 rounded-xl inline-flex flex-col items-center gap-4 max-w-md mx-auto border border-amber-200">
                    <AlertCircle className="w-12 h-12" />
                    <p className="text-lg font-medium">Selecione ao menos 1 adulto para continuar.</p>
                    <Button onClick={() => window.location.href = '/reservar'}>Alterar Busca</Button>
                </div>
            </main>
        );
    }

    if (isOverCapacity) {
        const whatsappUrl = getWhatsAppUrl();
        return (
            <main className="min-h-screen pt-32 container text-center bg-muted/30">
                <div className="bg-amber-50 text-amber-900 p-6 rounded-xl inline-flex flex-col items-center gap-4 max-w-md mx-auto border border-amber-200">
                    <AlertCircle className="w-12 h-12" />
                    <p className="text-lg font-medium">
                        Nossas acomodações comportam até 3 pessoas por quarto. Para grupos maiores, fale com a gente no WhatsApp.
                    </p>
                    <Button asChild>
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                            Falar com a pousada no WhatsApp
                        </a>
                    </Button>
                </div>
            </main>
        );
    }

    /* Removed if(loading) block to allow inline skeleton rendering */

    /* Inline Skeleton Component */
    const RoomListSkeleton = () => (
        <div className="space-y-6 animate-pulse">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-border/50 overflow-hidden">
                    <div className="grid md:grid-cols-12">
                        <div className="md:col-span-4 bg-muted h-64 md:h-80 relative">
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                                <Camera className="w-12 h-12" />
                            </div>
                        </div>
                        <div className="md:col-span-8 p-6 space-y-4">
                            <div className="h-8 bg-muted rounded w-48" />
                            <div className="space-y-2">
                                <div className="h-4 bg-muted rounded w-full" />
                                <div className="h-4 bg-muted rounded w-5/6" />
                            </div>
                            <div className="flex gap-2 mt-4">
                                {[1, 2, 3, 4].map((j) => (
                                    <div key={j} className="h-6 bg-muted rounded-full w-20" />
                                ))}
                            </div>
                            <div className="flex justify-between items-center mt-6 pt-4 border-t">
                                <div className="h-8 bg-muted rounded w-32" />
                                <div className="h-10 bg-muted rounded w-48" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    if (error) {
        return (
            <main className="min-h-screen pt-32 container text-center bg-muted/30">
                <div className="bg-destructive/10 text-destructive p-6 rounded-xl inline-flex flex-col items-center gap-4 max-w-md mx-auto border border-destructive/20">
                    <AlertCircle className="w-12 h-12" />
                    <p className="text-lg font-medium">{error}</p>
                    <Button onClick={() => window.location.href = '/reservar'} variant="destructive">Tentar Novamente</Button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen pt-28 pb-12 bg-muted/30">
            <div className="container mx-auto px-4">
                {/* Header da Busca */}
                <div className="bg-white rounded-xl shadow-sm border border-border/50 p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-full text-primary">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold font-heading text-primary">Disponibilidade</h1>
                            <p className="text-muted-foreground text-sm flex flex-col gap-1 leading-tight">
                                <span>{formatDate(checkIn!)} - {formatDate(checkOut!)}</span>
                                <span>{stayNights} {stayNights === 1 ? 'noite' : 'noites'}</span>
                                <span>{adults} Adultos, {children} Crianças</span>
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => window.location.href = '/reservar'} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Alterar Busca
                    </Button>
                </div>

                {!selectedRoom ? (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold font-heading text-primary pl-1">Escolha sua Acomodação</h2>

                        {loading || availableRooms === null ? (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <p className="text-muted-foreground">Buscando as melhores opções para você</p>
                                </div>
                                <RoomListSkeleton />
                            </div>
                        ) : availableRooms.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-border">
                                <p className="text-xl text-muted-foreground mb-4">Nenhum quarto disponível para as datas selecionadas.</p>
                                <Button onClick={() => window.location.href = '/reservar'}>
                                    Buscar Outras Datas
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {availableRooms.map((room) => (
                                    <Card key={room.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 border-border/50 group">
                                        <div className="grid md:grid-cols-12 gap-0">
                                            <div className="md:col-span-4 relative h-64 md:h-auto overflow-hidden">
                                                {getRoomPrimaryImageSrc(room) ? (
                                                    <Image
                                                        src={getRoomPrimaryImageSrc(room)!}
                                                        alt={room.name}
                                                        fill
                                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                                        <span className="text-muted-foreground">Sem foto</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="md:col-span-8 p-6 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-2xl font-bold font-heading text-primary">{room.name}</h3>
                                                        <div className="text-right hidden md:block">
                                                            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total da estadia</span>
                                                            <p className="text-2xl font-bold text-primary">R$ {room.totalPrice.toFixed(2)}</p>
                                                            <p className="text-xs text-muted-foreground">{stayNights} {stayNights === 1 ? 'noite' : 'noites'}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-muted-foreground mb-4" style={{ whiteSpace: 'pre-line' }}>
                                                        {room.description}
                                                    </p>

                                                    <div className="flex flex-wrap gap-2 mb-6">
                                                        {room.amenities.split(',').map((amenity, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary-foreground rounded-full text-xs font-medium border border-secondary/20">
                                                                <Check className="w-3 h-3" /> {amenity.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="mt-4 border-t pt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <div className="md:hidden">
                                                        <span className="text-xs text-muted-foreground">Total</span>
                                                        <p className="text-xl font-bold text-primary">R$ {room.totalPrice.toFixed(2)}</p>
                                                        <p className="text-xs text-muted-foreground">{stayNights} {stayNights === 1 ? 'noite' : 'noites'}</p>
                                                    </div>
                                                    <Button size="lg" onClick={() => handleSelectRoom(room)} className="w-auto md:ml-auto shadow-lg shadow-primary/20 h-10 px-4 text-sm">
                                                        Selecionar e Continuar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                ) : paymentBookingId ? (
                    <div className="max-w-4xl mx-auto">
                        <Card className="border-border/50 shadow-lg">
                            <CardHeader className="bg-primary/5 border-b border-border/60 pb-6">
                                <CardTitle className="text-xl">Pagamento</CardTitle>
                                <CardDescription>Escolha o método e finalize sua reserva com segurança.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {Number(paymentAmount || 0) > 0 ? (
                                    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Valor total a pagar</span>
                                        <strong className="text-lg font-bold text-primary">R$ {Number(paymentAmount || 0).toFixed(2)}</strong>
                                    </div>
                                ) : null}
                                {paymentError ? (
                                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
                                        {paymentError}
                                    </div>
                                ) : null}

                                {paymentStatus !== 'idle' && paymentStatusMessage ? (
                                    <div className={`p-4 rounded-xl border mt-4 ${paymentStatus === 'approved' ? 'bg-green-50 border-green-200 text-green-700' : paymentStatus === 'pending' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                        {paymentStatusMessage}
                                    </div>
                                ) : null}

                                <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                                    <div>
                                        <h3 className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                                            Meios de pagamento
                                        </h3>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Parcelamento aparece após preencher os primeiros dígitos do cartão.
                                        </p>
                                        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm">
                                            <div id={paymentContainerId} />
                                        </div>
                                    </div>

                                    <div className="bg-white border border-border/60 rounded-xl p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-xs font-semibold text-primary uppercase tracking-widest">
                                                Pix instantâneo
                                            </h3>
                                            {pixData?.ticket_url ? (
                                                <a
                                                    href={pixData.ticket_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-primary underline"
                                                >
                                                    Abrir Pix
                                                </a>
                                            ) : null}
                                        </div>

                                        {pixData?.qr_code_base64 ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <Image
                                                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                                                    alt="QR Code Pix"
                                                    width={200}
                                                    height={200}
                                                    unoptimized
                                                    className="h-[200px] w-[200px] rounded-lg bg-white p-2 border border-border/60"
                                                />
                                                {pixData.qr_code ? (
                                                    <div className="w-full">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-xs text-muted-foreground">Pix copia e cola</label>
                                                            <button
                                                                type="button"
                                                                className="text-xs text-primary underline"
                                                                onClick={async () => {
                                                                    try {
                                                                        await navigator.clipboard.writeText(pixData.qr_code || '');
                                                                        setPixCopied(true);
                                                                        setTimeout(() => setPixCopied(false), 2000);
                                                                    } catch {
                                                                        // fallback silencioso
                                                                    }
                                                                }}
                                                            >
                                                                {pixCopied ? 'Copiado!' : 'Copiar'}
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            readOnly
                                                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                                                            rows={3}
                                                            value={pixData.qr_code}
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                O QR Code aparecerá aqui após gerar o Pix.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="lg:col-span-2 space-y-6">
                            <Button variant="ghost" onClick={() => { clearCouponState(true); setSelectedRoom(null); }} className="pl-0 hover:pl-2 transition-all gap-2 text-muted-foreground">
                                <ArrowLeft className="w-4 h-4" /> Voltar para seleção de quartos
                            </Button>

                            <Card id="guest-form" className="border-border/50 shadow-md">
                                <CardHeader className="bg-muted/30 border-b border-border/50 pb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">Dados do Hóspede Principal</CardTitle>
                                            <CardDescription>Informações para contato e voucher</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                                                    <User className="w-4 h-4 text-muted-foreground" /> Nome Completo *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="name"
                                                    required
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    placeholder="Digite seu nome completo"
                                                    value={guest.name}
                                                    onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                                                    disabled={processing}
                                                />
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                                                        <Mail className="w-4 h-4 text-muted-foreground" /> Email *
                                                    </label>
                                                    <input
                                                        type="email"
                                                        id="email"
                                                        required
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        placeholder="seu@email.com"
                                                        value={guest.email}
                                                        onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                                                        disabled={processing}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                                                        <Phone className="w-4 h-4 text-muted-foreground" /> Telefone/WhatsApp *
                                                    </label>
                                                    <input
                                                        type="tel"
                                                        id="phone"
                                                        required
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        placeholder="(00) 00000-0000"
                                                        value={guest.phone}
                                                        onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                                                        disabled={processing}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                                            <label htmlFor="couponCode" className="text-sm font-medium">Cupom de desconto</label>
                                            <div className="flex flex-col gap-2 md:flex-row">
                                                <input
                                                    id="couponCode"
                                                    type="text"
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                    placeholder="Ex: VIP10"
                                                    value={couponCode}
                                                    onChange={(e) => {
                                                        setCouponCode(e.target.value.toUpperCase());
                                                        setPendingCouponOverride(false);
                                                    }}
                                                    disabled={processing || couponApplying}
                                                />
                                                <Button type="button" variant="outline" onClick={applyCoupon} disabled={processing || couponApplying}>
                                                    {couponApplying ? 'Aplicando...' : 'Aplicar'}
                                                </Button>
                                                {appliedCoupon ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => clearCouponState(true)}
                                                        disabled={processing || couponApplying}
                                                    >
                                                        Remover
                                                    </Button>
                                                ) : null}
                                            </div>
                                            {couponMessage ? (
                                                <p className={`text-xs ${appliedCoupon ? 'text-emerald-600' : 'text-destructive'}`}>{couponMessage}</p>
                                            ) : null}
                                            {hasPendingCouponToApply ? (
                                                <p className="text-xs text-amber-700">Cupom digitado, mas ainda não aplicado.</p>
                                            ) : null}
                                        </div>

                                        <div className="bg-secondary/5 p-4 rounded-lg border border-secondary/20">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="terms"
                                                    checked={termsAccepted}
                                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                                    disabled={processing}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                                                    Declaro que li e aceito os{' '}
                                                    <Link href="/termos-e-condicoes" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">termos e condições</Link>,{' '}
                                                    <Link href="/politica-de-cancelamento" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">política de cancelamento</Link>{' '}
                                                    e{' '}
                                                    <Link href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">política de privacidade</Link>{' '}
                                                    da Pousada Delplata.
                                                </label>
                                            </div>
                                        </div>

                                        {formMessage ? (
                                            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                                {formMessage}
                                            </div>
                                        ) : null}

                                        <Button type="submit" className="w-full h-12 text-lg shadow-lg shadow-primary/20" size="lg" disabled={processing}>
                                            {processing ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    Processando...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <CreditCard className="w-5 h-5" /> Ir para Pagamento Seguro
                                                </span>
                                            )}
                                        </Button>

                                        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span> Ambiente seguro e criptografado
                                        </p>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-1">
                            <Card className="sticky top-28 border-border/50 shadow-md overflow-hidden">
                                <div className="bg-primary p-4 text-white text-center">
                                    <h3 className="font-bold text-lg">Resumo da Reserva</h3>
                                </div>
                                <div className="aspect-video relative">
                                    {getRoomPrimaryImageSrc(selectedRoom) && (
                                        <Image
                                            src={getRoomPrimaryImageSrc(selectedRoom)!}
                                            alt={selectedRoom.name}
                                            fill
                                            className="object-cover"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                        <h3 className="font-bold text-white text-lg shadow-sm">{selectedRoom.name}</h3>
                                    </div>
                                </div>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Check-in</span>
                                            <span className="font-medium">{formatDateBR(checkIn!)}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Check-out</span>
                                            <span className="font-medium">{formatDateBR(checkOut!)}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Hóspedes</span>
                                            <span className="font-medium">{adults} Adultos, {children} Crianças</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Diárias</span>
                                            <span className="font-medium">
                                                {Math.ceil((new Date(checkOut!).getTime() - new Date(checkIn!).getTime()) / (1000 * 60 * 60 * 24))} noites
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-4 rounded-lg mt-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm text-muted-foreground">{bookingDiscount > 0 ? 'Total com desconto' : 'Total'}</span>
                                            <span className="text-2xl font-bold text-primary">R$ {bookingTotal.toFixed(2)}</span>
                                        </div>
                                        {selectedRoom.priceBreakdown ? (
                                            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                                                <div className="flex justify-between">
                                                    <span>Base</span>
                                                    <span>R$ {Number(selectedRoom.priceBreakdown.baseTotal).toFixed(2)}</span>
                                                </div>
                                                {appliedCoupon ? (
                                                    <>
                                                        <div className="flex justify-between text-emerald-600">
                                                            <span>Desconto ({appliedCoupon.code})</span>
                                                            <span>- R$ {bookingDiscount.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between font-semibold text-foreground">
                                                            <span>Subtotal</span>
                                                            <span>R$ {bookingSubtotal.toFixed(2)}</span>
                                                        </div>
                                                    </>
                                                ) : null}
                                                {selectedRoom.priceBreakdown.extraAdultTotal > 0 ? (
                                                    <div className="flex justify-between">
                                                        <span>Adulto extra</span>
                                                        <span>R$ {Number(selectedRoom.priceBreakdown.extraAdultTotal).toFixed(2)}</span>
                                                    </div>
                                                ) : null}
                                                {selectedRoom.priceBreakdown.childTotal > 0 ? (
                                                    <div className="flex justify-between">
                                                        <span>Crianças 6–11</span>
                                                        <span>R$ {Number(selectedRoom.priceBreakdown.childTotal).toFixed(2)}</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground text-right">Taxas e impostos inclusos</p>
                                        )}
                                    </div>

                                    <Button variant="outline" className="w-full border-dashed" onClick={() => { clearCouponState(true); setSelectedRoom(null); }}>
                                        Trocar Quarto
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function ReservarPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen pt-24 flex items-center justify-center bg-muted/30">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </main>
        }>
            <ReservarContent />
        </Suspense>
    );
}










