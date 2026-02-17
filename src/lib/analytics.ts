'use client';

type EventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: any[]) => void;
    }
}

function canTrack() {
    return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

export function trackEvent(eventName: string, params: EventParams = {}) {
    if (!canTrack()) return;
    window.gtag?.('event', eventName, params);
}

export function trackClickReservar(label: string) {
    trackEvent('click_reservar', {
        event_category: 'engajamento',
        event_label: label,
    });
}

export function trackClickWhatsApp(label: string) {
    trackEvent('click_whatsapp', {
        event_category: 'contato',
        event_label: label,
    });
}

export function trackBeginCheckout(params: {
    value?: number;
    currency?: string;
    bookingId?: string;
    roomName?: string;
    adults?: number;
    children?: number;
} = {}) {
    trackEvent('begin_checkout', {
        event_category: 'ecommerce',
        event_label: 'inicio_checkout',
        value: params.value,
        currency: params.currency || 'BRL',
        booking_id: params.bookingId,
        room_name: params.roomName,
        adults: params.adults,
        children: params.children,
    });
}

export function trackReservaConfirmada(params: {
    value?: number;
    currency?: string;
    bookingId?: string;
    paymentMethod?: string;
    roomName?: string;
    adults?: number;
    children?: number;
} = {}) {
    trackEvent('reserva_confirmada', {
        event_category: 'ecommerce',
        event_label: 'reserva_confirmada',
        value: params.value,
        currency: params.currency || 'BRL',
        booking_id: params.bookingId,
        payment_method: params.paymentMethod,
        room_name: params.roomName,
        adults: params.adults,
        children: params.children,
    });
}

