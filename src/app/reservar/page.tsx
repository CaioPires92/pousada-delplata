'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useEffectEvent, useState, Suspense, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SearchWidget from '@/components/SearchWidget';
import AvailabilityBar from './components/AvailabilityBar';
import ReservationPageFallback from './components/ReservationPageFallback';
import ReservationFaq from './components/ReservationFaq';
import { SiGoogle } from 'react-icons/si';

import {
    Check,
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    Camera,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Coffee,
    CreditCard,
    History,
    Mail,
    Phone,
    ShieldCheck,
    Snowflake,
    Tv,
    User,
    Wifi,
    Wind,
    X,
    Flame,
    LoaderCircle,
    PlugZap,
} from 'lucide-react';
import { getLocalRoomPhotos } from '@/lib/room-photos';
import { formatDateBR, formatDateBRFromYmd } from '@/lib/date';
import { buildPaymentBrickInitializationPayer, normalizePaymentBrickPayer } from './payment-brick';
import { trackAddPaymentInfo, trackBeginCheckout, trackClickWhatsApp, trackReservationFunnel, trackSelectItem, trackViewItemList } from '@/lib/analytics';
import { buildBookingWhatsAppUrl } from '@/lib/booking-whatsapp';
import { SOCIAL_PROOF_RATINGS } from '@/constants/socialProof';
import {
    mountLatestPaymentBrick,
    safelyUnmountPaymentBrick,
    type PaymentBrickController,
} from '@/lib/payment-brick-lifecycle';
 

interface Room {
    id: string;
    name: string;
    description: string;
    capacity: number;
    maxGuests?: number;
    inventoryFor4Guests?: number;
    amenities: string;
    totalPrice: number;
    priceOriginal?: number;
    priceDiscounted?: number;
    discountAmount?: number;
    promoApplied?: boolean;
    promoMessage?: string;
    promoCodeNormalized?: string;
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

interface RoomGalleryState {
    roomName: string;
    photos: string[];
    currentIndex: number;
}

type PaymentMode = 'FULL' | 'PARTIAL';

type PartialPaymentEvaluation = {
    enabled: boolean;
    eligible: boolean;
    reasons: string[];
    defaultPaymentMode: PaymentMode;
    percentage: number;
    fullAmount: number;
    partialAmount: number;
    remainingAmount: number;
    balanceDueAt: 'CHECK_IN' | 'BEFORE_CHECK_IN';
    balanceDueDate: string | null;
};

const PIX_DISCOUNT_RATE = 0.05;

function applyPixDiscount(amount: number) {
    return Number((amount * (1 - PIX_DISCOUNT_RATE)).toFixed(2));
}

function isPixBrickPayment(formData: any) {
    const paymentMethodId = String(formData?.payment_method_id || '').trim().toLowerCase();
    const paymentTypeId = String(formData?.payment_type_id || '').trim().toLowerCase();
    return paymentMethodId === 'pix' || paymentTypeId === 'bank_transfer';
}

function RoomListSkeleton() {
    return (
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
}

const PAGE_TRUST_ITEMS = [
    {
        value: 'Direto',
        label: 'Atendimento da pousada',
        description: 'Fale conosco pelo WhatsApp',
        icon: Phone,
    },
    {
        value: `${SOCIAL_PROOF_RATINGS.google.score.toFixed(1).replace('.', ',')}/5`,
        label: 'Google',
        description: `${SOCIAL_PROOF_RATINGS.google.reviews} avaliações`,
        icon: SiGoogle,
    },
    {
        value: '15+ anos',
        label: 'Recebendo hóspedes',
        description: 'Tradição e hospitalidade',
        icon: History,
    },
];

const MP_TEST_CARDS = [
    { label: 'Mastercard credito', number: '5031 4332 1540 6351', securityCode: '123', expiry: '11/30' },
    { label: 'Visa credito', number: '4235 6477 2802 5682', securityCode: '123', expiry: '11/30' },
    { label: 'Amex credito', number: '3753 651535 56885', securityCode: '1234', expiry: '11/30' },
    { label: 'Elo debito', number: '5067 7667 8388 8311', securityCode: '123', expiry: '11/30' },
];

const MP_TEST_SCENARIOS = [
    { status: 'Aprovado', holderName: 'APRO', document: '12345678909' },
    { status: 'Pendente', holderName: 'CONT', document: 'Nao exige CPF' },
    { status: 'Saldo insuficiente', holderName: 'FUND', document: 'Nao exige CPF' },
    { status: 'Codigo invalido', holderName: 'SECU', document: 'Nao exige CPF' },
];

const PAYMENT_LOADING_STEPS = [
    'Validando dados do pagamento',
    'Enviando ao Mercado Pago',
    'Preparando a confirmacao',
];

function getAmenityIcon(amenity: string) {
    const normalized = String(amenity || '').toLowerCase();

    if (normalized.includes('wifi')) return Wifi;
    if (normalized.includes('ar-condicionado') || normalized.includes('ar condicionado')) return Snowflake;
    if (normalized.includes('smart tv') || normalized.includes('tv')) return Tv;
    if (normalized.includes('ventilador')) return Wind;
    if (normalized.includes('churrasqueira')) return Flame;
    if (normalized.includes('tomadas')) return PlugZap;
    return Check;
}

function normalizePaymentUiErrorMessage(message: unknown) {
    const raw = String(message || '').trim();
    const normalized = raw.toLowerCase();

    if (!raw || normalized === 'internal_error' || normalized === 'unknown error') {
        return 'Nao foi possivel processar o pagamento agora. Tente novamente em instantes ou fale com a pousada no WhatsApp.';
    }

    return raw;
}

function normalizeReservationUiErrorMessage(message: unknown) {
    const raw = String(message || '').trim();
    const normalized = raw.toLowerCase();

    const isTechnicalError =
        !raw ||
        normalized.includes('prisma.') ||
        normalized.includes('sql_') ||
        normalized.includes('sqlite') ||
        normalized.includes('database') ||
        normalized.includes('stack') ||
        normalized.includes('invocation') ||
        normalized === 'booking_create_failed' ||
        normalized === 'internal_server_error';

    if (isTechnicalError) {
        return 'Nao foi possivel iniciar sua reserva agora. Fale com a pousada pelo WhatsApp para receber ajuda.';
    }

    return raw;
}

function ReservarContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const adults = searchParams.get('adults') || '2';
    const children = searchParams.get('children') || '0';
    const childrenAgesParam = searchParams.get('childrenAges') || '';
    const promoFromQuery = String(searchParams.get('promo') || searchParams.get('coupon') || '').trim().toUpperCase();
    const preferredRoomTypeId = String(searchParams.get('roomTypeId') || '').trim();

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
    const [, setCouponMessage] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
    const [formMessage, setFormMessage] = useState('');
    const [, setPromoAppliedInResults] = useState(false);
    const [loading, setLoading] = useState(true); // Start with true to show initial loading
    const [error, setError] = useState('');
    const [availabilityRetryNonce, setAvailabilityRetryNonce] = useState(0);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('FULL');
    const [partialPaymentEvaluation, setPartialPaymentEvaluation] = useState<PartialPaymentEvaluation | null>(null);
    const [paymentError, setPaymentError] = useState<string>('');
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'approved' | 'rejected' | 'pending' | 'error'>('idle');
    const [paymentStatusMessage, setPaymentStatusMessage] = useState<string>('');
    const [paymentRetryNonce, setPaymentRetryNonce] = useState(0);
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [testDataCopied, setTestDataCopied] = useState<string | null>(null);
    const [pixData, setPixData] = useState<{ qr_code?: string; qr_code_base64?: string; ticket_url?: string } | null>(null);
    const [pixCopied, setPixCopied] = useState(false);
    const [roomGallery, setRoomGallery] = useState<RoomGalleryState | null>(null);
    const [mobileSummaryExpanded, setMobileSummaryExpanded] = useState(false);
    const [searchEditorOpen, setSearchEditorOpen] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const bookingSubmitLockRef = useRef(false);
    const paymentSubmitLockRef = useRef(false);
    const paymentBrickRef = useRef<PaymentBrickController | null>(null);
    const paymentBrickRequestRef = useRef(0);
    const paymentContainerId = 'paymentBrick_container';
    const mountedRef = useRef(true);
    const lastKeyRef = useRef<string>(''); // Track last request to avoid duplicates
    const hasLoadedOnce = useRef(false); // Track if we've completed at least one fetch
    const selectedRoomRef = useRef<Room | null>(null);
    const maxGuests = 4;
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

    const getRoomDisplayPhotos = (room: Room) => {
        const backendUrls = (room.photos ?? [])
            .map((p) => p?.url?.trim())
            .filter((url): url is string => Boolean(url))
            .filter((url) => !isPlaceholderUrl(url));

        if (backendUrls.length > 0) return backendUrls;

        const localPhotos = getLocalRoomPhotos(room.name);
        return localPhotos ?? [];
    };

    const getRoomPrimaryImageSrc = (room: Room) => {
        const photos = getRoomDisplayPhotos(room);
        return photos[0] ?? null;
    };

    const openRoomGallery = (room: Room, startIndex = 0) => {
        const photos = getRoomDisplayPhotos(room);
        if (photos.length === 0) return;
        const normalizedIndex = Math.min(Math.max(startIndex, 0), photos.length - 1);
        setRoomGallery({
            roomName: room.name,
            photos,
            currentIndex: normalizedIndex,
        });
    };

    const closeRoomGallery = () => {
        setRoomGallery(null);
    };

    const showNextGalleryPhoto = () => {
        setRoomGallery((prev) => {
            if (!prev || prev.photos.length <= 1) return prev;
            return {
                ...prev,
                currentIndex: (prev.currentIndex + 1) % prev.photos.length,
            };
        });
    };

    const showPrevGalleryPhoto = () => {
        setRoomGallery((prev) => {
            if (!prev || prev.photos.length <= 1) return prev;
            return {
                ...prev,
                currentIndex: (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length,
            };
        });
    };

    useEffect(() => {
        if (!roomGallery) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeRoomGallery();
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [roomGallery]);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return formatDateBRFromYmd(dateString);
    };

    const parseAmount = (value: unknown) => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;

        const raw = String(value ?? '').trim();
        if (!raw) return Number.NaN;

        // Suporta "1436.00" e tambem "1.436,00".
        const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : Number.NaN;
    };

    const formatCurrencyBRL = (value: number) => `R$ ${Number(value).toFixed(2)}`;

    const getPartialPaymentUnavailableMessage = (reasons: string[]) => {
        if (reasons.includes('disabled')) return 'Pagamento parcial indisponível no momento.';
        if (reasons.includes('below_minimum_amount')) return 'Esta reserva exige pagamento integral porque não atingiu o valor mínimo configurado.';
        if (reasons.includes('below_minimum_lead_time')) return 'Esta reserva exige pagamento integral devido à proximidade do check-in.';
        return 'Esta reserva exige pagamento integral.';
    };

    const stayNights = useMemo(() => {
        if (!checkIn || !checkOut) return 0;
        const diff = Math.ceil(
            (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)
        );
        return Math.max(0, diff);
    }, [checkIn, checkOut]);

    const roomSubtotal = selectedRoom ? Number(selectedRoom.priceOriginal ?? selectedRoom.totalPrice) : 0;
    const bookingSubtotal = appliedCoupon ? Number(appliedCoupon.subtotal || roomSubtotal) : roomSubtotal;
    const bookingDiscount = appliedCoupon ? Number(appliedCoupon.discountAmount || 0) : 0;
    const bookingTotal = appliedCoupon
        ? Number(appliedCoupon.total || Math.max(0, bookingSubtotal - bookingDiscount))
        : (selectedRoom ? Number(selectedRoom.totalPrice) : 0);
    const handleRetryPayment = () => {
        setPaymentError('');
        setPaymentStatus('idle');
        setPaymentStatusMessage('');
        setIsSubmittingPayment(false);
        setPixData(null);

        setPaymentRetryNonce((prev) => prev + 1);
    };
    const handlePaymentModeChange = (nextMode: PaymentMode) => {
        if (!partialPaymentEvaluation || !partialPaymentEvaluation.eligible) return;

        const nextAmount = nextMode === 'PARTIAL'
            ? Number(partialPaymentEvaluation.partialAmount)
            : Number(partialPaymentEvaluation.fullAmount);

        setPaymentMode(nextMode);
        setPaymentAmount(nextAmount);
        setPaymentError('');
        setPaymentStatus('idle');
        setPaymentStatusMessage('');
        setPixData(null);
        setIsSubmittingPayment(false);

        setPaymentRetryNonce((prev) => prev + 1);
    };
    const currentStep = paymentBookingId ? 3 : selectedRoom ? 2 : 1;
    const totalSteps = 3;
    const progressPercent = Math.round((currentStep / totalSteps) * 100);
    const showPaymentTestHelper = process.env.NODE_ENV !== 'production'
        && (
            process.env.NEXT_PUBLIC_ENABLE_TEST_PAYMENTS === 'true'
            || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.startsWith('TEST-')
        );

    const copyTestValue = async (key: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setTestDataCopied(key);
            setTimeout(() => setTestDataCopied((current) => current === key ? null : current), 1800);
        } catch {
            // noop
        }
    };
    const paymentLoadingStepIndex = isSubmittingPayment ? 1 : 0;

    useEffect(() => {
        selectedRoomRef.current = selectedRoom;
    }, [selectedRoom]);

    useEffect(() => {
        if (promoFromQuery) {
            const timeoutId = window.setTimeout(() => {
                setCouponCode(promoFromQuery);
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
        if (!selectedRoom) {
            const timeoutId = window.setTimeout(() => {
                setCouponCode('');
                setCouponMessage('');
                setPromoAppliedInResults(false);
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [promoFromQuery, selectedRoom]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setSearchEditorOpen(false);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [checkIn, checkOut, adults, children, childrenAgesKey]);

    const getWhatsAppUrl = (context?: 'error_form' | 'error_payment') => {
        const checkInStr = checkIn ? formatDate(checkIn) : 'DATA INDEFINIDA';
        const checkOutStr = checkOut ? formatDate(checkOut) : 'DATA INDEFINIDA';
        return buildBookingWhatsAppUrl({
            phone: process.env.NEXT_PUBLIC_HOTEL_WHATSAPP_LINK
                || process.env.NEXT_PUBLIC_HOTEL_WHATSAPP,
            context: context || 'quote',
            bookingId: paymentBookingId,
            guestName: guest.name,
            roomName: selectedRoom?.name,
            amountLabel: context === 'error_payment' && Number(paymentAmount || 0) > 0
                ? formatCurrencyBRL(Number(paymentAmount))
                : null,
            adults: numAdults,
            children: numChildren,
            checkInLabel: checkInStr,
            checkOutLabel: checkOutStr,
        });
    };

    const notifyPaymentDifficulty = useCallback((payload: {
        step: string;
        reason: string;
        error?: string;
        funnelStage?: string;
    }) => {
        if (!guest.name || !guest.email) return;

        fetch('/api/notify-difficulty', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guestName: guest.name,
                guestEmail: guest.email,
                guestPhone: guest.phone,
                bookingId: paymentBookingId || undefined,
                roomName: selectedRoom?.name,
                totalPrice: paymentAmount ?? bookingTotal,
                step: payload.step,
                reason: payload.reason,
                error: payload.error,
                funnelStage: payload.funnelStage,
            }),
        }).catch(() => {});
    }, [bookingTotal, guest.email, guest.name, guest.phone, paymentAmount, paymentBookingId, selectedRoom?.name]);

    const fetchAvailability = useEffectEvent(async (signal?: AbortSignal) => {
        if (!checkIn || !checkOut || isOverCapacity || isInvalidAdults) {
            // Early return for invalid inputs - ensure loading is false
            if (mountedRef.current) {
                setLoading(false);
                hasLoadedOnce.current = true;
            }
            return;
        }

        // Create stable request key for deduplication
        const normalizedPromo = promoFromQuery;
        const requestKey = `${checkIn}|${checkOut}|${adults}|${children}|${childrenAgesKey}|${normalizedPromo}`;

        // Deduplicate: if same request already in flight or just completed, skip
        if (requestKey === lastKeyRef.current) {
            // Still mark as loaded even if skipping
            if (mountedRef.current && !hasLoadedOnce.current) {
                setLoading(false);
                hasLoadedOnce.current = true;
            }
            return;
        }

        try {
            // Clear previous results and start loading
            if (mountedRef.current) {
                setAvailableRooms(null);
                setLoading(true);
                setError('');
            }

            const childrenAgesQuery = childrenAges.length > 0 ? `&childrenAges=${encodeURIComponent(childrenAges.join(','))}` : '';
            const promoQuery = normalizedPromo ? `&promo=${encodeURIComponent(normalizedPromo)}` : '';
            const response = await fetch(
                `/api/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}${childrenAgesQuery}${promoQuery}`,
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
            const orderedRooms = Array.isArray(data) && preferredRoomTypeId
                ? [...data].sort((left: Room, right: Room) => {
                    if (left.id === preferredRoomTypeId) return -1;
                    if (right.id === preferredRoomTypeId) return 1;
                    return 0;
                })
                : data;
            const responsePromoApplied = response.headers.get('x-promo-applied') === 'true';
            const responsePromoMessage = response.headers.get('x-promo-message') || '';

            if (mountedRef.current) {
                setAvailableRooms(orderedRooms);
                setPromoAppliedInResults(responsePromoApplied);
                setCouponMessage(responsePromoMessage);

                const currentSelectedRoom = selectedRoomRef.current;
                if (Array.isArray(orderedRooms) && currentSelectedRoom) {
                    const refreshedSelectedRoom = orderedRooms.find((room: Room) => room.id === currentSelectedRoom.id);

                    if (!refreshedSelectedRoom) {
                        setAppliedCoupon(null);
                        setSelectedRoom(null);
                        setFormMessage('A acomodação selecionada não está disponível para a nova busca. Escolha outro quarto.');
                    } else {
                        const currentTotal = Number(currentSelectedRoom.totalPrice);
                        const refreshedTotal = Number(refreshedSelectedRoom.totalPrice);
                        const currentBase = Number(currentSelectedRoom.priceOriginal ?? currentSelectedRoom.totalPrice);
                        const refreshedBase = Number(refreshedSelectedRoom.priceOriginal ?? refreshedSelectedRoom.totalPrice);
                        const currentBreakdown = JSON.stringify(currentSelectedRoom.priceBreakdown ?? null);
                        const refreshedBreakdown = JSON.stringify(refreshedSelectedRoom.priceBreakdown ?? null);
                        const priceChanged = currentTotal !== refreshedTotal || currentBase !== refreshedBase || currentBreakdown !== refreshedBreakdown;

                        if (priceChanged) {
                            setAppliedCoupon(null);
                            setSelectedRoom(refreshedSelectedRoom);
                            setFormMessage('');
                        }
                    }
                }
                hasLoadedOnce.current = true;
            }

            // Mark this request as completed ONLY after successful fetch
            // This prevents Strict Mode double-run from seeing it as duplicate before first completes
            lastKeyRef.current = requestKey;

        } catch (err: any) {
            if (err && err.name === 'AbortError') {
            } else {
                if (mountedRef.current) {
                    const message = err instanceof Error ? err.message : 'Erro ao carregar quartos disponíveis. Tente novamente.';
                    setError(message);
                    hasLoadedOnce.current = true;
                    trackReservationFunnel({
                        step: 'availability_loaded',
                        status: 'error',
                        message,
                    });
                }
            }
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    });

    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            mountedRef.current = true;
            void fetchAvailability(controller.signal);
        }, 0);
        return () => {
            window.clearTimeout(timeoutId);
            mountedRef.current = false;
            controller.abort();
        };
    }, [adults, availabilityRetryNonce, checkIn, checkOut, children, childrenAgesKey, preferredRoomTypeId, promoFromQuery, isInvalidAdults, isOverCapacity]);

    useEffect(() => {
        if (!Array.isArray(availableRooms)) return;
        if (availableRooms.length > 0) trackViewItemList(availableRooms);
        trackReservationFunnel({
            step: 'availability_loaded',
            status: 'success',
            value: availableRooms.length,
        });
    }, [availableRooms]);

    const retryAvailability = () => {
        setError('');
        setAvailableRooms(null);
        setLoading(true);
        lastKeyRef.current = '';
        setAvailabilityRetryNonce((current) => current + 1);
    };

    const releaseCouponReservation = async (reservationId?: string) => {
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
    };

    const clearCouponState = (withRelease: boolean) => {
        if (withRelease && appliedCoupon?.reservationId) {
            void releaseCouponReservation(appliedCoupon.reservationId);
        }
        setAppliedCoupon(null);
        setFormMessage('');
    };

    const applyCoupon = async (room: Room): Promise<AppliedCoupon | null> => {
        const normalizedCode = couponCode.trim().toUpperCase();
        if (!normalizedCode) {
            setAppliedCoupon(null);
            setCouponMessage('');
            return null;
        }
        if (!room.promoApplied) {
            setAppliedCoupon(null);
            return null;
        }

        setFormMessage('');

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
                        roomTypeId: room.id,
                        source: 'direct',
                        subtotal: Number(room.priceOriginal ?? room.totalPrice),
                    },
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data?.valid) {
                const reason = String(data?.reason || data?.error || 'INVALID_CODE');
                const reasonMessage = reason === 'MIN_BOOKING_NOT_REACHED'
                    ? 'Cupom indisponível: valor mínimo da reserva não atingido.'
                    : reason === 'EXPIRED'
                        ? 'Este cupom expirou.'
                        : reason === 'NOT_STARTED'
                            ? 'Este cupom ainda não está ativo.'
                            : reason === 'GUEST_NOT_ELIGIBLE'
                                ? 'Este cupom não é válido para este hóspede.'
                                : reason === 'USAGE_LIMIT_REACHED' || reason === 'GUEST_USAGE_LIMIT_REACHED'
                                    ? 'Limite de uso deste cupom foi atingido.'
                                    : 'Cupom inválido ou indisponível.';

                setAppliedCoupon(null);
                setCouponMessage(reasonMessage);
                return null;
            }

            if (appliedCoupon?.reservationId && appliedCoupon.reservationId !== data.reservationId) {
                void releaseCouponReservation(appliedCoupon.reservationId);
            }

            const discountAmount = Number(data?.discountAmount || 0);
            const subtotal = Number(data?.subtotal || Number(room.priceOriginal ?? room.totalPrice));
            const total = Number(data?.total || Math.max(0, subtotal - discountAmount));

            const nextAppliedCoupon = {
                reservationId: String(data.reservationId),
                code: normalizedCode.toUpperCase(),
                discountAmount,
                subtotal,
                total,
                expiresAt: data?.reservationExpiresAt ? String(data.reservationExpiresAt) : undefined,
            };

            setAppliedCoupon(nextAppliedCoupon);
            setCouponCode(normalizedCode.toUpperCase());
            setCouponMessage('Cupom aplicado com sucesso.');
            setFormMessage('');
            return nextAppliedCoupon;
        } catch {
            setCouponMessage('Não foi possível validar o cupom. Tente novamente.');
            return null;
        }
    };

    useEffect(() => {
        return () => {
            if (appliedCoupon?.reservationId) {
                void fetch('/api/coupons/release', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reservationId: appliedCoupon.reservationId,
                        guest: { email: guest.email },
                    }),
                }).catch(() => {
                    // best-effort release on unmount
                });
            }
        };
    }, [appliedCoupon, guest.email]);

    const handleSelectRoom = async (room: Room) => {
        if (appliedCoupon?.reservationId) {
            await releaseCouponReservation(appliedCoupon.reservationId);
            setAppliedCoupon(null);
        }

        let nextRoom = room;
        if (couponCode.trim()) {
            const reservedCoupon = await applyCoupon(room);
            if (!reservedCoupon) {
                nextRoom = {
                    ...room,
                    totalPrice: Number(room.priceOriginal ?? room.totalPrice),
                    promoApplied: false,
                    priceDiscounted: undefined,
                    discountAmount: 0,
                };
            }
        }

        setFormMessage('');
        setMobileSummaryExpanded(false);
        setSelectedRoom(nextRoom);
        trackSelectItem(nextRoom);
        trackReservationFunnel({
            step: 'room_selected',
            roomId: nextRoom.id,
            roomName: nextRoom.name,
            value: nextRoom.totalPrice,
        });
        setTimeout(() => {
            document.getElementById('guest-form')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (bookingSubmitLockRef.current) return;
        setFormMessage('');

        if (!selectedRoom) {
            setFormMessage('Por favor, selecione um quarto.');
            return;
        }

        if (!termsAccepted) {
            setFormMessage('Por favor, aceite os termos e condições.');
            return;
        }

        bookingSubmitLockRef.current = true;
        try {
            setProcessing(true);
            setFormMessage('');

            let couponPayload = appliedCoupon ? {
                reservationId: appliedCoupon.reservationId,
                code: appliedCoupon.code,
            } : undefined;

            if (couponCode.trim()) {
                const refreshedCoupon = await applyCoupon(selectedRoom);
                if (!refreshedCoupon) {
                    setFormMessage('Revise o cupom antes de continuar.');
                    return;
                }

                couponPayload = {
                    reservationId: refreshedCoupon.reservationId,
                    code: refreshedCoupon.code,
                };
            }

            trackBeginCheckout({
                value: bookingTotal,
                items: [
                    {
                        item_id: selectedRoom.id,
                        item_name: selectedRoom.name,
                        item_category: 'Hospedagem',
                        price: Number(bookingTotal),
                        quantity: 1,
                    },
                ],
            });
            trackReservationFunnel({
                step: 'guest_form_submitted',
                roomId: selectedRoom.id,
                roomName: selectedRoom.name,
                value: bookingTotal,
            });

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
                    coupon: couponPayload,
                }),
            });

            if (!bookingResponse.ok) {
                const errorData = await bookingResponse.json().catch(() => ({}));
                if (errorData?.error === 'room_unavailable') {
                    throw new Error('Essa acomodação não está mais disponível para a ocupação selecionada. Faça uma nova busca.');
                }
                throw new Error(errorData.message || errorData.error || 'Erro ao criar reserva');
            }

            const booking = await bookingResponse.json();
            const parsedAmount = parseAmount(booking?.totalPrice);
            let nextPaymentMode: PaymentMode = 'FULL';
            let nextPaymentAmount = parsedAmount;
            let nextPartialEvaluation: PartialPaymentEvaluation | null = null;

            if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
                try {
                    const params = new URLSearchParams({
                        totalAmount: String(parsedAmount),
                        checkIn: String(checkIn),
                    });
                    const partialResponse = await fetch(`/api/partial-payment/evaluate?${params.toString()}`);
                    if (partialResponse.ok) {
                        const partialData = await partialResponse.json();
                        nextPartialEvaluation = partialData;
                        if (partialData?.eligible && partialData?.defaultPaymentMode === 'PARTIAL') {
                            nextPaymentMode = 'PARTIAL';
                            nextPaymentAmount = parseAmount(partialData.partialAmount);
                        }
                    }
                } catch {
                    nextPartialEvaluation = null;
                }
            }

            setPaymentBookingId(booking.id);
            setPartialPaymentEvaluation(nextPartialEvaluation);
            setPaymentMode(nextPaymentMode);
            setPaymentAmount(nextPaymentMode === 'PARTIAL' && Number.isFinite(nextPaymentAmount) ? nextPaymentAmount : parsedAmount);
            setPixData(null);
            trackReservationFunnel({
                step: 'payment_started',
                bookingId: booking.id,
                roomId: selectedRoom.id,
                roomName: selectedRoom.name,
                value: nextPaymentMode === 'PARTIAL' && Number.isFinite(nextPaymentAmount) ? nextPaymentAmount : parsedAmount,
                message: nextPaymentMode === 'PARTIAL' ? 'partial_payment' : 'full_payment',
            });

            if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                setPaymentStatus('error');
                setPaymentStatusMessage('');
                setPaymentError('Nao foi possivel iniciar o pagamento. Valor da reserva invalido. Refaça a busca ou fale conosco no WhatsApp.');
                return;
            }

            setPaymentError('');
            setPaymentStatus('idle');
            setPaymentStatusMessage('');

        } catch (err) {
            const message = normalizeReservationUiErrorMessage(
                err instanceof Error ? err.message : 'Erro ao processar reserva. Tente novamente.'
            );
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
                setFormMessage('Revise o cupom antes de continuar.');
            } else {
                setFormMessage(message);
            }
            trackReservationFunnel({
                step: 'guest_form_submitted',
                status: 'error',
                roomId: selectedRoom?.id,
                roomName: selectedRoom?.name,
                value: bookingTotal,
                message,
            });
        } finally {
            bookingSubmitLockRef.current = false;
            setProcessing(false);
        }
    };

    useEffect(() => {
        if (!paymentBookingId || paymentAmount === null || Number.isNaN(paymentAmount)) return;

        paymentSubmitLockRef.current = false;
        const requestId = ++paymentBrickRequestRef.current;
        let mountedBrick: PaymentBrickController | null = null;
        const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
        if (!publicKey) {
            const timeoutId = window.setTimeout(() => {
                setPaymentError('Chave pública do Mercado Pago não configurada.');
            }, 0);
            notifyPaymentDifficulty({
                step: 'Inicializacao do pagamento',
                reason: 'Brick nao carregou',
                error: 'NEXT_PUBLIC_MP_PUBLIC_KEY ausente',
                funnelStage: 'PAYMENT_ERROR',
            });
            trackReservationFunnel({
                step: 'payment_started',
                status: 'error',
                bookingId: paymentBookingId,
                value: paymentAmount,
                message: 'public_key_missing',
            });
            return () => window.clearTimeout(timeoutId);
        }

        if (paymentAmount <= 0) {
            const timeoutId = window.setTimeout(() => {
                setPaymentError('Nao foi possivel carregar o formulario de pagamento: valor da reserva deve ser maior que zero.');
            }, 0);
            notifyPaymentDifficulty({
                step: 'Inicializacao do pagamento',
                reason: 'Valor invalido para carregar o Brick',
                error: 'payment_amount_invalid',
                funnelStage: 'PAYMENT_ERROR',
            });
            trackReservationFunnel({
                step: 'payment_started',
                status: 'error',
                bookingId: paymentBookingId,
                value: paymentAmount,
                message: 'invalid_payment_amount',
            });
            return () => window.clearTimeout(timeoutId);
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
                if (paymentBrickRequestRef.current !== requestId) return;

                const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
                const bricksBuilder = mp.bricks();

                const payerData = buildPaymentBrickInitializationPayer(guest.email);

                mountedBrick = await mountLatestPaymentBrick({
                    requestId,
                    latestRequestRef: paymentBrickRequestRef,
                    activeBrickRef: paymentBrickRef,
                    create: () => bricksBuilder.create('payment', paymentContainerId, {
                    initialization: {
                        amount: paymentAmount,
                        payer: payerData,
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
                        onSubmit: async ({ formData }: any) => {
                            if (paymentSubmitLockRef.current) return;
                            paymentSubmitLockRef.current = true;
                            setIsSubmittingPayment(true);
                            setPaymentError('');
                            setPaymentStatus('idle');
                            setPaymentStatusMessage('');

                            const normalizedPayer = normalizePaymentBrickPayer({
                                payerFromBrick: formData?.payer,
                                guestName: guest.name,
                                guestEmail: guest.email,
                            });
                            const finalPaymentAmount = isPixBrickPayment(formData)
                                ? applyPixDiscount(paymentAmount)
                                : paymentAmount;
                            const paymentType = isPixBrickPayment(formData)
                                ? 'pix'
                                : String(formData?.payment_method_id || formData?.payment_type_id || 'card');

                            trackAddPaymentInfo({
                                bookingId: paymentBookingId,
                                value: finalPaymentAmount,
                                paymentType,
                                items: selectedRoom ? [{
                                    item_id: selectedRoom.id,
                                    item_name: selectedRoom.name,
                                    item_category: 'Hospedagem',
                                    price: finalPaymentAmount,
                                    quantity: 1,
                                }] : [],
                            });

                            let keepOverlayUntilRedirect = false;

                            try {
                                const res = await fetch('/api/mercadopago/payment', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        ...formData,
                                        payer: normalizedPayer,
                                        bookingId: paymentBookingId,
                                        description: `Reserva ${paymentBookingId}`,
                                        transaction_amount: finalPaymentAmount,
                                        paymentMode,
                                    }),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                    const msg = normalizePaymentUiErrorMessage(data?.message || data?.error || 'Erro ao processar pagamento');
                                    setPaymentStatus('error');
                                    setPaymentStatusMessage('');
                                    setPaymentError(msg);
                                    throw new Error(msg);
                                }

                                const status = data?.status;
                                const pix = data?.pix;
                                if (pix) setPixData(pix);
                                if (status === 'approved') {
                                    keepOverlayUntilRedirect = true;
                                    setPaymentStatus('approved');
                                    setPaymentStatusMessage('Pagamento aprovado! Redirecionando...');
                                    trackReservationFunnel({
                                        step: 'payment_result',
                                        status: 'success',
                                        bookingId: paymentBookingId,
                                        value: finalPaymentAmount,
                                        message: 'approved',
                                    });
                                    router.push(`/reservar/confirmacao/${paymentBookingId}`);
                                    return;
                                }

                                if (status === 'rejected') {
                                    setPaymentStatus('rejected');
                                    setPaymentStatusMessage('Pagamento não aprovado. Você pode revisar os dados ou tentar outro método com segurança.');
                                    trackReservationFunnel({
                                        step: 'payment_result',
                                        status: 'error',
                                        bookingId: paymentBookingId,
                                        value: finalPaymentAmount,
                                        message: 'rejected',
                                    });
                                    return;
                                }

                                setPaymentStatus('pending');
                                if (pix?.qr_code || pix?.qr_code_base64) {
                                    setPaymentStatusMessage(`Pix gerado com sucesso com 5% de desconto (${formatCurrencyBRL(finalPaymentAmount)}). Use o QR Code ou copie o código abaixo para concluir sua reserva.`);
                                } else {
                                    setPaymentStatusMessage('Pagamento em análise. Assim que houver confirmação, sua reserva será atualizada automaticamente.');
                                }
                                trackReservationFunnel({
                                    step: 'payment_result',
                                    status: 'pending',
                                    bookingId: paymentBookingId,
                                    value: finalPaymentAmount,
                                    message: pix?.qr_code || pix?.qr_code_base64 ? 'pix_pending' : 'analysis_pending',
                                });
                            } finally {
                                if (!keepOverlayUntilRedirect) {
                                    paymentSubmitLockRef.current = false;
                                    setIsSubmittingPayment(false);
                                }
                            }
                        },
                        onError: (err: any) => {
                            paymentSubmitLockRef.current = false;
                            setIsSubmittingPayment(false);
                            console.error('Mercado Pago Brick Error:', err);
                            setPaymentStatus('error');
                            const errorMessage = String(err?.message || err?.error || '');
                            if (/dado obrigat[oó]rio|required/i.test(errorMessage)) {
                                setPaymentError('Preencha o nome do titular manualmente (sem auto preenchimento) e tente novamente.');
                                notifyPaymentDifficulty({
                                    step: 'Brick Mercado Pago',
                                    reason: 'Dados do pagador ausentes',
                                    error: errorMessage || 'required_field_error',
                                    funnelStage: 'PAYMENT_ERROR',
                                });
                                trackReservationFunnel({
                                    step: 'payment_result',
                                    status: 'error',
                                    bookingId: paymentBookingId,
                                    value: paymentAmount,
                                    message: 'required_field_error',
                                });
                                return;
                            }
                            setPaymentError('Nao foi possivel carregar o formulario de pagamento. Atualize a pagina e tente sem bloqueadores de anuncio.');
                            notifyPaymentDifficulty({
                                step: 'Brick Mercado Pago',
                                reason: 'Erro tecnico no Brick',
                                error: errorMessage || 'brick_error',
                                funnelStage: 'PAYMENT_ERROR',
                            });
                            trackReservationFunnel({
                                step: 'payment_result',
                                status: 'error',
                                bookingId: paymentBookingId,
                                value: paymentAmount,
                                message: 'brick_error',
                            });
                        },
                    },
                    }),
                });
            } catch (err) {
                if (paymentBrickRequestRef.current !== requestId) return;
                paymentSubmitLockRef.current = false;
                setIsSubmittingPayment(false);
                console.error(err);
                setPaymentError('Nao foi possivel inicializar o pagamento. Verifique sua conexao e tente sem bloqueadores de anuncio.');
                notifyPaymentDifficulty({
                    step: 'Inicializacao do pagamento',
                    reason: 'Falha de comunicacao com o Mercado Pago',
                    error: err instanceof Error ? err.message : 'sdk_init_error',
                    funnelStage: 'PAYMENT_ERROR',
                });
                trackReservationFunnel({
                    step: 'payment_started',
                    status: 'error',
                    bookingId: paymentBookingId,
                    value: paymentAmount,
                    message: 'sdk_init_error',
                });
            }
        };

        initBrick();
        return () => {
            if (paymentBrickRequestRef.current === requestId) {
                paymentBrickRequestRef.current += 1;
            }

            if (mountedBrick && paymentBrickRef.current === mountedBrick) {
                paymentBrickRef.current = null;
                void safelyUnmountPaymentBrick(mountedBrick);
            }
        };
    }, [guest.email, guest.name, notifyPaymentDifficulty, paymentAmount, paymentBookingId, paymentMode, paymentRetryNonce, router, selectedRoom]);

    useEffect(() => {
        if (!paymentBookingId) return;
        if (pollRef.current) return;

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/bookings/${paymentBookingId}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data?.status === 'CONFIRMED') {
                    setPaymentStatus('approved');
                    setPaymentStatusMessage('Pagamento aprovado! Redirecionando...');
                    trackReservationFunnel({
                        step: 'payment_result',
                        status: 'success',
                        bookingId: paymentBookingId,
                        value: paymentAmount,
                        message: 'confirmed_polling',
                    });
                    if (pollRef.current) clearInterval(pollRef.current);
                    router.push(`/reservar/confirmacao/${paymentBookingId}`);
                } else if (data?.status === 'CANCELLED') {
                    setPaymentStatus('rejected');
                    setPaymentStatusMessage('Pagamento não aprovado. Revise os dados ou tente outro método.');
                    trackReservationFunnel({
                        step: 'payment_result',
                        status: 'error',
                        bookingId: paymentBookingId,
                        value: paymentAmount,
                        message: 'cancelled_polling',
                    });
                    if (pollRef.current) clearInterval(pollRef.current);
                }
            } catch {
                // ignora falhas de rede temporárias
            }
        }, 10000);

        pollRef.current = pollInterval;
        return () => {
            clearInterval(pollInterval);
            if (pollRef.current === pollInterval) {
                pollRef.current = null;
            }
        };
    }, [paymentAmount, paymentBookingId, router]);

    if (!checkIn || !checkOut) {
        return (
            <main className="relative flex min-h-screen items-center justify-center bg-[color:var(--brand-black)]">
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/fotos/piscina-aptos/DJI_0845.jpg"
                        alt="Background"
                        fill
                        sizes="100vw"
                        className="object-cover object-center"
                        priority
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(40,50,35,0.78)_0%,rgba(40,50,35,0.52)_42%,rgba(9,9,9,0.24)_100%)] backdrop-blur-[2px]" />
                </div>

                <div className="container relative z-10 max-w-7xl mx-auto px-4">
                    <div className="text-center mb-8 text-white">
                        <p className="font-accent text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">
                            Reservas
                        </p>
                        <h1 className="font-sans mb-4 mt-4 text-[2.9rem] font-semibold leading-[0.98] md:text-[4rem]">
                            Planeje sua Estadia
                        </h1>
                        <p className="mx-auto max-w-2xl text-lg font-semibold leading-8 text-white/88">
                            Selecione as datas da sua viagem para conferir nossas acomodações exclusivas e garantir o melhor preço.
                        </p>
                    </div>

                    <div className="w-full">
                        <SearchWidget
                            variant="light"
                            uiPreset="hero"
                            heroLayout="horizontal"
                            hideCouponField
                            submitLabel="Ver disponibilidade"
                            submitLabelMobile="Buscar"
                        />
                    </div>
                </div>
            </main>
        );
    }

    if (isInvalidAdults) {
        return (
        <main className="min-h-screen bg-[color:var(--brand-cream)] pt-32">
            <div className="container text-center">
            <div className="inline-flex max-w-md flex-col items-center gap-4 border border-amber-200 bg-amber-50 p-6 text-amber-900">
                <AlertCircle className="w-12 h-12" />
                <p className="text-lg font-medium">Selecione ao menos 1 adulto para continuar.</p>
                <Button onClick={() => router.push('/reservar')}>Alterar Busca</Button>
            </div>
            </div>
        </main>
        );
    }

    if (isOverCapacity) {
        const whatsappUrl = getWhatsAppUrl();
        return (
            <main className="min-h-screen bg-[color:var(--brand-cream)] pt-32">
                <div className="container text-center">
                <div className="inline-flex max-w-md flex-col items-center gap-4 border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    <AlertCircle className="w-12 h-12" />
                    <p className="text-lg font-medium">
                        Nossas acomodações comportam até 4 pessoas por quarto, conforme disponibilidade. Para grupos maiores, fale com a gente no WhatsApp.
                    </p>
                    <p className="text-sm leading-6 text-amber-900/80">
                        Assim conseguimos sugerir a melhor combinação de acomodações para a sua viagem.
                    </p>
                    <Button asChild>
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                            Falar com a pousada no WhatsApp
                        </a>
                    </Button>
                </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-[color:var(--brand-cream)] pt-32">
                <div className="container text-center">
                <div className="inline-flex max-w-md flex-col items-center gap-4 border border-destructive/20 bg-destructive/10 p-6 text-destructive">
                    <AlertCircle className="w-12 h-12" />
                    <p className="text-lg font-medium">{error}</p>
                    <p className="text-sm leading-6 text-destructive/80">
                        Atualize a busca ou tente novamente em instantes. Se preferir, fale com a pousada para confirmar a disponibilidade.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button onClick={retryAvailability} variant="destructive">Tentar novamente</Button>
                        <Button variant="outline" asChild className="rounded-none">
                            <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer">
                                Falar com a pousada
                            </a>
                        </Button>
                    </div>
                </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen pt-28 pb-12 bg-muted/30">
            <div className="container mx-auto box-border w-full max-w-[1440px] px-4">
                <AvailabilityBar
                    checkIn={checkIn!}
                    checkOut={checkOut!}
                    adults={numAdults}
                    childrenCount={numChildren}
                    alterControl={
                        <Button
                            type="button"
                            size="sm"
                            className="h-9 rounded-none font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => setSearchEditorOpen((prev) => !prev)}
                        >
                            {searchEditorOpen ? 'Fechar busca' : 'Alterar busca'}
                        </Button>
                    }
                />
                {searchEditorOpen ? (
                    <div className="mb-6">
                        <SearchWidget
                            variant="light"
                            uiPreset="hero"
                            heroLayout="horizontal"
                            hideCouponField
                            prefillFromQuery
                            submitLabel="Ver disponibilidade"
                            submitLabelMobile="Buscar"
                        />
                    </div>
                ) : null}

                <div className="mb-6 border border-primary/10 bg-[color:var(--brand-white)] px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium text-foreground">Passo {currentStep} de {totalSteps}</p>
                        <p className="text-xs text-muted-foreground">
                            {currentStep === 1 ? 'Escolha da acomodação' : currentStep === 2 ? 'Dados e revisão' : 'Pagamento'}
                        </p>
                    </div>
                    <div className="mt-2 h-2 w-full bg-[color:var(--brand-cream)]">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {!selectedRoom ? (
                    <div className="space-y-6">
                        {loading || availableRooms === null ? (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <p className="text-muted-foreground">Buscando as melhores opções para você</p>
                                </div>
                                <RoomListSkeleton />
                            </div>
                        ) : availableRooms.length === 0 ? (
                            <div className="border border-dashed border-primary/20 bg-[color:var(--brand-white)] py-16 text-center">
                                <p className="mb-3 text-xl text-muted-foreground">Nenhum quarto disponível para as datas selecionadas.</p>
                                <p className="mx-auto mb-6 max-w-2xl text-sm leading-7 text-muted-foreground">
                                    Tente ajustar as datas ou a ocupação. Em feriados e fins de semana, a disponibilidade muda rápido.
                                </p>
                                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                                    <Button onClick={() => router.push('/reservar')}>
                                        Buscar Outras Datas
                                    </Button>
                                    <Button variant="outline" asChild className="rounded-none">
                                        <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer">
                                            Falar com a pousada
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h2 className="font-sans text-[2rem] font-semibold tracking-[-0.02em] text-foreground md:text-[2.35rem]">
                                        Escolha sua Acomodação
                                    </h2>
                                    <p className="text-lg text-foreground/82">
                                        {availableRooms.length} acomodaç{availableRooms.length === 1 ? 'ão' : 'ões'} disponíveis para estas datas
                                    </p>
                                    <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-sm text-primary/80">
                                        <span className="inline-flex items-center gap-2"><Coffee className="h-4 w-4" /> Café da manhã diário</span>
                                        <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> Valor total exibido</span>
                                        <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Pix ou cartão</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                    {availableRooms.map((room) => {
                                        const roomPhotos = getRoomDisplayPhotos(room);
                                        const roomPrimaryImage = roomPhotos[0] ?? null;
                                        const canOpenGallery = roomPhotos.length > 0;
                                        const roomAmenities = room.amenities
                                            .split(',')
                                            .map((amenity) => amenity.trim())
                                            .filter(Boolean);
                                        const nightlyRate = stayNights > 0 ? room.totalPrice / stayNights : room.totalPrice;
                                        const originalNightlyRate = room.promoApplied && Number(room.priceOriginal) > Number(room.totalPrice) && stayNights > 0
                                            ? Number(room.priceOriginal) / stayNights
                                            : null;
                                        const hasSavings = room.promoApplied && Number(room.discountAmount || 0) > 0;
                                        const roomDescription = room.description?.trim()
                                            || 'Descrição detalhada não informada. Consulte a pousada antes de reservar.';
                                        return (
                                        <Card
                                            key={room.id}
                                            className="group flex h-full flex-col overflow-hidden rounded-none border border-primary/10 bg-[color:var(--brand-white)] shadow-none transition-all duration-300 hover:border-primary/25"
                                        >
                                            <div
                                                className={`relative aspect-[16/9] overflow-hidden bg-[color:var(--brand-cream)] ${canOpenGallery ? 'cursor-zoom-in' : ''}`}
                                                role={canOpenGallery ? 'button' : undefined}
                                                tabIndex={canOpenGallery ? 0 : undefined}
                                                onClick={canOpenGallery ? () => openRoomGallery(room) : undefined}
                                                onKeyDown={canOpenGallery ? (event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        openRoomGallery(room);
                                                    }
                                                } : undefined}
                                                aria-label={canOpenGallery ? `Abrir galeria de fotos de ${room.name}` : undefined}
                                            >
                                                {roomPrimaryImage ? (
                                                    <Image
                                                        src={roomPrimaryImage}
                                                        alt={room.name}
                                                        fill
                                                        sizes="(max-width: 1279px) 100vw, 50vw"
                                                        className="object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                                        <span className="text-muted-foreground">Sem foto</span>
                                                    </div>
                                                )}
                                                {canOpenGallery ? (
                                                    <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 bg-black/58 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm">
                                                        <Camera className="h-3.5 w-3.5" />
                                                        <span>Ver fotos ({roomPhotos.length})</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="flex flex-1 flex-col p-5 md:p-6">
                                                <h3 className="font-sans text-[1.55rem] font-semibold leading-tight tracking-[-0.02em] text-primary md:text-[1.75rem]">
                                                    {room.name}
                                                </h3>
                                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/72">{roomDescription}</p>

                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {roomAmenities.slice(0, 4).map((amenity, i) => {
                                                        const AmenityIcon = getAmenityIcon(amenity);
                                                        return (
                                                            <span key={i} className="inline-flex items-center gap-1.5 border border-primary/10 bg-[color:var(--brand-cream)] px-2.5 py-1.5 text-xs font-medium text-primary">
                                                                <AmenityIcon className="h-3.5 w-3.5 text-primary/78" /> {amenity}
                                                            </span>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-auto grid items-end gap-4 border-t border-primary/10 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)]">
                                                    <div>
                                                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground/58">Total da estadia</p>
                                                        {originalNightlyRate ? <p className="mt-1 text-sm text-muted-foreground line-through">{formatCurrencyBRL(originalNightlyRate * stayNights)}</p> : null}
                                                        <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-primary">{formatCurrencyBRL(room.totalPrice)}</p>
                                                        <p className="mt-2 text-xs text-foreground/68">{stayNights} {stayNights === 1 ? 'noite' : 'noites'} · {formatCurrencyBRL(nightlyRate)} por noite</p>
                                                        {hasSavings ? <p className="mt-1 text-xs font-medium text-emerald-700">Economia de {formatCurrencyBRL(Number(room.discountAmount))}</p> : null}
                                                    </div>
                                                    <Button size="lg" onClick={() => handleSelectRoom(room)} className="h-[50px] w-full rounded-none bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-none hover:bg-primary/95">
                                                        Escolher acomodação <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                    </Card>
                                    )})}
                                </div>

                                <div className="border border-primary/10 bg-[color:var(--brand-white)] px-4 py-4 shadow-none md:px-5">
                                    <div className="grid gap-4 md:grid-cols-3 md:gap-0">
                                        {PAGE_TRUST_ITEMS.map((item, index) => (
                                            <div
                                                key={`${item.label}-${item.value}`}
                                                className={`flex items-center gap-3 py-1 ${index === 0 ? '' : 'md:border-l md:border-primary/10 md:pl-5'} ${index < PAGE_TRUST_ITEMS.length - 1 ? 'md:pr-5' : ''}`}
                                            >
                                                <div className="flex shrink-0 items-center justify-center text-primary/78">
                                                    <item.icon className="h-7 w-7" aria-hidden />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-lg font-semibold leading-none text-primary">
                                                        {item.value}
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold leading-5 text-foreground">
                                                        {item.label}
                                                    </p>
                                                    {item.description ? (
                                                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                                            {item.description}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : paymentBookingId ? (
                    <div className="max-w-4xl mx-auto">
                        <Card className="rounded-none border border-primary/10 bg-[color:var(--brand-white)] shadow-none">
                            <CardHeader className="border-b border-primary/10 bg-[color:var(--brand-cream)] pb-6">
                                <CardTitle className="text-xl">Pagamento</CardTitle>
                                <CardDescription>Escolha o método e finalize sua reserva com segurança.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {partialPaymentEvaluation?.eligible ? (
                                    <div className="mb-4 space-y-3 border border-primary/10 bg-[color:var(--brand-white)] px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-semibold text-primary">Como deseja pagar?</span>
                                            <span className="text-xs text-muted-foreground">
                                                Você pode pagar o total agora ou deixar o saldo restante para {partialPaymentEvaluation.balanceDueAt === 'CHECK_IN' ? 'o check-in' : 'antes do check-in'}.
                                            </span>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <button
                                                type="button"
                                                onClick={() => void handlePaymentModeChange('FULL')}
                                                disabled={isSubmittingPayment}
                                                className={`border px-4 py-3 text-left transition ${paymentMode === 'FULL' ? 'border-primary bg-[color:var(--brand-cream)]' : 'border-primary/10 bg-white hover:border-primary/40'} disabled:opacity-60`}
                                            >
                                                <span className="block text-sm font-bold text-primary">Pagar total</span>
                                                <span className="mt-1 block text-lg font-black text-primary">{formatCurrencyBRL(partialPaymentEvaluation.fullAmount)}</span>
                                                <span className="mt-1 block text-xs text-muted-foreground">Reserva quitada no momento da confirmação.</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handlePaymentModeChange('PARTIAL')}
                                                disabled={isSubmittingPayment}
                                                className={`border px-4 py-3 text-left transition ${paymentMode === 'PARTIAL' ? 'border-emerald-600 bg-emerald-50' : 'border-primary/10 bg-white hover:border-emerald-300'} disabled:opacity-60`}
                                            >
                                                <span className="block text-sm font-bold text-emerald-700">Pagar sinal de {partialPaymentEvaluation.percentage}%</span>
                                                <span className="mt-1 block text-lg font-black text-emerald-700">{formatCurrencyBRL(partialPaymentEvaluation.partialAmount)}</span>
                                                <span className="mt-1 block text-xs text-muted-foreground">
                                                    Restante a pagar {partialPaymentEvaluation.balanceDueAt === 'CHECK_IN' ? 'no check-in' : 'antes do check-in'}: {formatCurrencyBRL(partialPaymentEvaluation.remainingAmount)}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                ) : partialPaymentEvaluation?.enabled ? (
                                    <div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        {getPartialPaymentUnavailableMessage(partialPaymentEvaluation.reasons)}
                                    </div>
                                ) : null}

                                {paymentMode === 'PARTIAL' && partialPaymentEvaluation?.eligible ? (
                                    <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        Restante a pagar {partialPaymentEvaluation.balanceDueAt === 'CHECK_IN' ? 'no check-in' : 'antes do check-in'}: <strong>{formatCurrencyBRL(partialPaymentEvaluation.remainingAmount)}</strong>.
                                    </div>
                                ) : null}

                                {Number(paymentAmount || 0) > 0 ? (
                                    <div className="mb-4 space-y-3 border border-primary/10 bg-[color:var(--brand-cream)] px-4 py-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-sm text-muted-foreground">Valor no cartão</span>
                                            <strong className="text-lg font-bold text-primary">{formatCurrencyBRL(Number(paymentAmount || 0))}</strong>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 border-t border-primary/10 pt-3">
                                            <span className="text-sm font-semibold text-emerald-700">Valor no Pix com 5% de desconto</span>
                                            <strong className="text-lg font-bold text-emerald-700">{formatCurrencyBRL(applyPixDiscount(Number(paymentAmount || 0)))}</strong>
                                        </div>
                                    </div>
                                ) : null}
                                {Number(paymentAmount || 0) > 0 ? (
                                    <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                        O desconto é aplicado automaticamente ao escolher Pix. Pagamentos por cartão permanecem no valor integral da reserva.
                                    </div>
                                ) : null}
                                <div className="mb-4 border border-primary/10 bg-[color:var(--brand-white)] px-4 py-3 text-sm text-foreground/76">
                                    Seus dados já foram enviados com segurança. Agora falta apenas concluir o pagamento para confirmar a reserva.
                                </div>
                                {paymentError ? (
                                    <div className="space-y-3 border border-destructive/20 bg-destructive/10 p-4 text-destructive">
                                        <p>{paymentError}</p>
                                        <div className="flex flex-col gap-3 sm:flex-row">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => void handleRetryPayment()}
                                                className="h-11 rounded-none border-destructive/30 bg-transparent text-destructive hover:bg-destructive/5"
                                            >
                                                Tentar novamente
                                            </Button>
                                            <Button
                                                variant="outline"
                                                asChild
                                                className="h-11 rounded-none border-destructive/30 bg-transparent text-destructive hover:bg-destructive/5"
                                            >
                                                <a
                                                    href={getWhatsAppUrl('error_payment')}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => trackClickWhatsApp('reserva_erro_pagamento')}
                                                >
                                                    Falar com a pousada no WhatsApp
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}

                                {paymentStatus !== 'idle' && paymentStatusMessage ? (
                                    <div className={`mt-4 border p-4 ${paymentStatus === 'approved' ? 'border-green-200 bg-green-50 text-green-700' : paymentStatus === 'pending' ? 'border-yellow-200 bg-yellow-50 text-yellow-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                        {paymentStatusMessage}
                                    </div>
                                ) : null}

                                {showPaymentTestHelper ? (
                                    <div className="mt-4 border border-amber-200 bg-amber-50 p-4 text-amber-950">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                                                    Modo teste Mercado Pago
                                                </p>
                                                <p className="mt-1 text-sm text-amber-900/80">
                                                    Os campos do brick nao podem ser preenchidos automaticamente, mas os dados de teste ficam acessiveis aqui.
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="rounded-none border-amber-300 bg-amber-100 text-amber-900">
                                                Sandbox
                                            </Badge>
                                        </div>

                                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                            <div className="space-y-3">
                                                <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">
                                                    Cartoes
                                                </p>
                                                {MP_TEST_CARDS.map((card) => (
                                                    <div key={card.label} className="border border-amber-200 bg-white/70 p-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="space-y-1 text-sm">
                                                                <p className="font-medium text-foreground">{card.label}</p>
                                                                <p className="font-mono text-foreground/80">{card.number}</p>
                                                                <p className="text-foreground/72">CVV {card.securityCode} • Validade {card.expiry}</p>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="rounded-none border-amber-300 bg-transparent"
                                                                onClick={() => void copyTestValue(`card:${card.label}`, `${card.number} | CVV ${card.securityCode} | ${card.expiry}`)}
                                                            >
                                                                {testDataCopied === `card:${card.label}` ? 'Copiado' : 'Copiar'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="space-y-3">
                                                <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">
                                                    Cenarios
                                                </p>
                                                {MP_TEST_SCENARIOS.map((scenario) => (
                                                    <div key={scenario.status} className="border border-amber-200 bg-white/70 p-3 text-sm">
                                                        <p className="font-medium text-foreground">{scenario.status}</p>
                                                        <div className="mt-2 flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-foreground/75">Titular: <span className="font-mono">{scenario.holderName}</span></p>
                                                                <p className="text-foreground/75">CPF: <span className="font-mono">{scenario.document}</span></p>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="rounded-none border-amber-300 bg-transparent"
                                                                onClick={() => void copyTestValue(`scenario:${scenario.status}`, `Titular ${scenario.holderName} | CPF ${scenario.document}`)}
                                                            >
                                                                {testDataCopied === `scenario:${scenario.status}` ? 'Copiado' : 'Copiar'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                                    <div>
                                        <h3 className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                                            Meios de pagamento
                                        </h3>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Parcelamento e opções disponíveis aparecem automaticamente conforme o método escolhido.
                                        </p>
                                        <div className="relative border border-primary/10 bg-[color:var(--brand-white)] p-4">
                                            {isSubmittingPayment ? (
                                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-[2px] px-6">
                                                    <div className="w-full max-w-md border border-white/10 bg-zinc-900 p-6 shadow-2xl">
                                                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10">
                                                            <LoaderCircle className="h-7 w-7 animate-spin text-white" />
                                                        </div>
                                                        <div className="mt-4 space-y-2 text-center">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/72">
                                                                Mercado Pago
                                                            </p>
                                                            <p className="text-lg font-semibold text-white">
                                                                Enviando seu pagamento
                                                            </p>
                                                            <p className="text-sm leading-6 text-white/78">
                                                                Isso pode levar alguns segundos. Nao feche esta pagina ate a confirmacao.
                                                            </p>
                                                        </div>

                                                        <div className="mt-5 space-y-3">
                                                            {PAYMENT_LOADING_STEPS.map((step, index) => {
                                                                const isActive = index === paymentLoadingStepIndex;
                                                                const isComplete = index < paymentLoadingStepIndex;
                                                                return (
                                                                    <div key={step} className="flex items-center gap-3 text-sm">
                                                                        <div className={`h-2.5 w-2.5 rounded-full ${isComplete ? 'bg-white' : isActive ? 'bg-[color:var(--brand-gold)] animate-pulse' : 'bg-white/25'}`} />
                                                                        <span className={isActive || isComplete ? 'text-white' : 'text-white/52'}>
                                                                            {step}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                            <div className={isSubmittingPayment ? 'pointer-events-none opacity-40 transition-opacity' : 'transition-opacity'}>
                                                <div id={paymentContainerId} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-primary/10 bg-[color:var(--brand-white)] p-4">
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
                                                    className="h-[200px] w-[200px] border border-primary/10 bg-[color:var(--brand-white)] p-2"
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
                                                            className="mt-1 w-full rounded-none border border-input bg-background px-3 py-2 text-xs"
                                                            rows={3}
                                                            value={pixData.qr_code}
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                Assim que o Pix for gerado, o QR Code aparecerá aqui para você concluir a reserva.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="grid min-w-0 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 lg:grid-cols-3">
                        <div className="sticky top-20 z-30 min-w-0 lg:hidden">
                            <div className="border border-primary/10 bg-[color:var(--brand-white)] px-4 py-3">
                                <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 text-left"
                                    onClick={() => setMobileSummaryExpanded((prev) => !prev)}
                                    aria-expanded={mobileSummaryExpanded}
                                    aria-controls="mobile-reservation-summary"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Resumo da Reserva</p>
                                        <p className="truncate text-sm font-medium text-foreground">{selectedRoom.name}</p>
                                        <p className="text-xs text-muted-foreground">{formatDateBR(checkIn!)} - {formatDateBR(checkOut!)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-sm font-bold text-primary">R$ {bookingTotal.toFixed(2)}</span>
                                        <span className="text-xs font-medium text-primary">
                                            {mobileSummaryExpanded ? 'Ocultar resumo' : 'Ver resumo'}
                                        </span>
                                        {mobileSummaryExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                </button>

                                {mobileSummaryExpanded ? (
                                    <div id="mobile-reservation-summary" className="mt-3 space-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                                        <div className="flex items-center justify-between">
                                            <span>Quarto</span>
                                            <span className="max-w-[70%] truncate text-right font-medium text-foreground">{selectedRoom.name}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Hóspedes</span>
                                            <span className="font-medium text-foreground">{adults} Adultos, {children} Crianças</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Diárias</span>
                                            <span className="font-medium text-foreground">{stayNights} {stayNights === 1 ? 'noite' : 'noites'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span>{bookingDiscount > 0 ? 'Total com desconto' : 'Total'}</span>
                                            <span className="font-bold text-primary">R$ {bookingTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="min-w-0 space-y-6 lg:col-span-2">
                            <Button variant="ghost" onClick={() => { clearCouponState(true); setSelectedRoom(null); }} className="pl-0 hover:pl-2 transition-all gap-2 text-muted-foreground">
                                <ArrowLeft className="w-4 h-4" /> Voltar para seleção de quartos
                            </Button>

                            <Card id="guest-form" className="min-w-0 overflow-hidden rounded-none border border-primary/10 bg-[color:var(--brand-white)] shadow-none">
                                <CardHeader className="border-b border-primary/10 bg-[color:var(--brand-cream)] pb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="border border-primary/10 bg-[color:var(--brand-white)] p-2 text-primary">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">Dados do Hóspede Principal</CardTitle>
                                            <CardDescription>Preencha seus dados para receber contato, voucher e confirmação da reserva.</CardDescription>
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
                                                    name="name"
                                                    autoComplete="name"
                                                    required
                                                    className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                                                        name="email"
                                                        autoComplete="email"
                                                        inputMode="email"
                                                        required
                                                        className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                                                        name="tel"
                                                        autoComplete="tel"
                                                        inputMode="tel"
                                                        required
                                                        className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        placeholder="(00) 00000-0000"
                                                        value={guest.phone}
                                                        onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                                                        disabled={processing}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {appliedCoupon ? (
                                            <div className="space-y-2 border border-emerald-200 bg-emerald-50/60 p-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium text-emerald-800">Cupom aplicado</span>
                                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                                                        {appliedCoupon.code}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-emerald-700">Desconto confirmado no resumo da reserva.</p>
                                            </div>
                                        ) : null}

                                        <div className="border border-primary/10 bg-[color:var(--brand-white)] p-3 text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground">Cancelamento:</span>{' '}
                                            Consulte prazos e condições antes de concluir a reserva.{' '}
                                            <Link
                                                href="/politica-de-cancelamento"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary font-medium hover:underline"
                                            >
                                                Ver política completa
                                            </Link>
                                            .
                                        </div>

                                        <div className="border border-primary/10 bg-[color:var(--brand-cream)] p-4">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="terms"
                                                    checked={termsAccepted}
                                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                                    disabled={processing}
                                                    className="mt-1 h-4 w-4 rounded-none border-gray-300 text-primary focus:ring-primary"
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
                                            <div role="alert" className="space-y-3 border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                                                <p>{formMessage}</p>
                                                <Button
                                                    variant="outline"
                                                    asChild
                                                    className="h-11 rounded-none border-destructive/30 bg-transparent text-destructive hover:bg-destructive/5"
                                                >
                                                    <a
                                                        href={getWhatsAppUrl('error_form')}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={() => trackClickWhatsApp('reserva_erro_formulario')}
                                                    >
                                                        Falar com a pousada no WhatsApp
                                                    </a>
                                                </Button>
                                            </div>
                                        ) : null}

                                        <Button type="submit" className="h-12 w-full rounded-none text-lg shadow-none" size="lg" disabled={processing}>
                                            {processing ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    Processando...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <CreditCard className="w-5 h-5" /> Continuar para o pagamento
                                                </span>
                                            )}
                                        </Button>

                                        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span> Pagamento processado pelo Mercado Pago
                                        </p>

                                        <div className="grid gap-3 border border-primary/10 bg-[color:var(--brand-cream)] px-4 py-4 sm:grid-cols-3">
                                            <div className="flex items-center gap-2 text-sm text-primary">
                                                <Check className="h-4 w-4" />
                                                <span>Café da manhã diário</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-primary">
                                                <Check className="h-4 w-4" />
                                                <span>Sem taxas extras</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-primary">
                                                <Check className="h-4 w-4" />
                                                <span>Atendimento direto da pousada</span>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 border border-primary/10 bg-[color:var(--brand-white)] px-4 py-4 md:grid-cols-2">
                                            <div>
                                                <p className="text-sm font-semibold text-primary">4,8/5 no Google</p>
                                                <p className="mt-1 text-xs text-foreground/72">Mais de 500 hóspedes avaliando</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-primary">Reserva direta e segura</p>
                                                <p className="mt-1 text-xs text-foreground/72">Pagamento processado com proteção via Mercado Pago.</p>
                                            </div>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="hidden lg:block lg:col-span-1">
                            <Card className="sticky top-28 overflow-hidden rounded-none border border-primary/10 bg-[color:var(--brand-white)] shadow-none">
                                <div className="bg-primary p-4 text-center text-white">
                                    <h3 className="font-bold text-lg">Sua reserva está quase confirmada</h3>
                                    <p className="mt-1 text-xs text-white/80">Revise seus dados para finalizar a reserva</p>
                                </div>
                                <div className="aspect-video relative">
                                    {getRoomPrimaryImageSrc(selectedRoom) && (
                                        <Image
                                            src={getRoomPrimaryImageSrc(selectedRoom)!}
                                            alt={selectedRoom.name}
                                            fill
                                            sizes="33vw"
                                            className="object-cover"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                        <h3 className="font-bold text-white text-lg shadow-sm">{selectedRoom.name}</h3>
                                    </div>
                                </div>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="grid gap-3 border border-primary/10 bg-[color:var(--brand-cream)] px-4 py-3 sm:grid-cols-2">
                                        <div className="flex items-center gap-2 text-sm text-primary">
                                            <Check className="h-4 w-4" />
                                            <span>Café da manhã diário</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-primary">
                                            <Check className="h-4 w-4" />
                                            <span>Valor total exibido</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-primary">
                                            <Check className="h-4 w-4" />
                                            <span>Pagamento via Pix ou cartão</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-primary">
                                            <Check className="h-4 w-4" />
                                            <span>Atendimento direto da pousada</span>
                                        </div>
                                    </div>
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

                                    <div className="mt-4 border border-primary/10 bg-[color:var(--brand-cream)] p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total da estadia</p>
                                        <div className="mt-2">
                                            <span className="text-[2.2rem] font-bold leading-none text-primary">R$ {bookingTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-sm text-primary/82">
                                            <span>{stayNights} {stayNights === 1 ? 'noite' : 'noites'}</span>
                                            <span>{adults} Adultos, {children} Crianças</span>
                                        </div>
                                        <p className="mt-2 text-xs font-medium text-emerald-700">Sem taxas extras</p>
                                        {selectedRoom.priceBreakdown ? (
                                            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                                                <div className="flex justify-between">
                                                    <span>Base ({stayNights} {stayNights === 1 ? 'diária' : 'diárias'})</span>
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
                                                        <span>Hóspedes adicionais</span>
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

                                    <div className="space-y-2 border-t border-primary/10 pt-4 text-xs text-foreground/72">
                                        <p>Pagamento com Pix ou cartão.</p>
                                        <p>Dados de pagamento processados pelo Mercado Pago.</p>
                                    </div>

                                    <Button variant="outline" className="w-full rounded-none border-dashed" onClick={() => { clearCouponState(true); setSelectedRoom(null); }}>
                                        Trocar Quarto
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
            <ReservationFaq />
            {roomGallery ? (
                <div
                    className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm p-4 flex items-center justify-center"
                    onClick={closeRoomGallery}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Galeria de fotos de ${roomGallery.roomName}`}
                >
                    <button
                        type="button"
                        onClick={closeRoomGallery}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-2"
                        aria-label="Fechar galeria"
                    >
                        <X className="w-7 h-7" />
                    </button>
                    <div
                        className="relative w-full max-w-6xl h-[82vh]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <Image
                            src={roomGallery.photos[roomGallery.currentIndex]}
                            alt={`${roomGallery.roomName} foto ${roomGallery.currentIndex + 1}`}
                            fill
                            className="object-contain"
                            sizes="(max-width: 768px) 100vw, 85vw"
                            priority
                        />
                        {roomGallery.photos.length > 1 ? (
                            <>
                                <button
                                    type="button"
                                    onClick={showPrevGalleryPhoto}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-lg bg-black/50 hover:bg-black/70 text-white p-3"
                                    aria-label="Foto anterior"
                                >
                                    <ChevronLeft className="w-7 h-7" />
                                </button>
                                <button
                                    type="button"
                                    onClick={showNextGalleryPhoto}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-lg bg-black/50 hover:bg-black/70 text-white p-3"
                                    aria-label="Próxima foto"
                                >
                                    <ChevronRight className="w-7 h-7" />
                                </button>
                            </>
                        ) : null}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white">
                            {roomGallery.currentIndex + 1} / {roomGallery.photos.length}
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
}

export default function ReservarPage() {
    return (
        <Suspense fallback={<ReservationPageFallback />}>
            <ReservarContent />
        </Suspense>
    );
}

