'use client';

type GaPrimitive = string | number | boolean | null | undefined;
type GaParams = Record<string, GaPrimitive | GaItem[]>;

export type GaItem = {
    item_id: string;
    item_name: string;
    item_category?: string;
    price?: number;
    quantity?: number;
    index?: number;
};

export type TrackSearchPayload = {
    checkIn?: string | null;
    checkOut?: string | null;
    adults?: number | string | null;
    children?: number | string | null;
};

export type RoomAnalyticsInput = {
    id?: string | null;
    roomTypeId?: string | null;
    name?: string | null;
    totalPrice?: number | string | null;
    price?: number | string | null;
    basePrice?: number | string | null;
};

export type BeginCheckoutPayload = {
    bookingId?: string;
    value?: number | string | null;
    currency?: string;
    items?: GaItem[];
};

export type PurchasePayload = {
    transactionId: string;
    value?: number | string | null;
    currency?: string;
    items?: GaItem[];
};

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

function isBrowser() {
    return typeof window !== 'undefined';
}

function hasGtag() {
    return isBrowser() && typeof window.gtag === 'function';
}

function toNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = '') {
    const parsed = String(value ?? '').trim();
    return parsed || fallback;
}

function getRoomId(room: RoomAnalyticsInput) {
    return toStringValue(room.roomTypeId || room.id, 'room_unknown');
}

function getRoomName(room: RoomAnalyticsInput) {
    return toStringValue(room.name, 'Hospedagem');
}

function getRoomPrice(room: RoomAnalyticsInput) {
    return toNumber(room.totalPrice ?? room.price ?? room.basePrice, 0);
}

function buildItem(room: RoomAnalyticsInput, index?: number): GaItem {
    return {
        item_id: getRoomId(room),
        item_name: getRoomName(room),
        item_category: 'Hospedagem',
        price: getRoomPrice(room),
        quantity: 1,
        index,
    };
}

export function gaEvent(name: string, params: GaParams = {}) {
    if (!hasGtag()) return;
    window.gtag?.('event', name, params);
}

export function trackSearch(payload: TrackSearchPayload) {
    gaEvent('search', {
        check_in: payload.checkIn || undefined,
        check_out: payload.checkOut || undefined,
        adults: toNumber(payload.adults, 0),
        children: toNumber(payload.children, 0),
    });
}

export function trackViewItemList(rooms: RoomAnalyticsInput[]) {
    if (!Array.isArray(rooms) || rooms.length === 0) return;
    const items = rooms.map((room, index) => buildItem(room, index));
    gaEvent('view_item_list', {
        item_list_id: 'lista_quartos',
        item_list_name: 'Lista de Quartos',
        items,
    });
}

export function trackSelectItem(room: RoomAnalyticsInput, index = 0) {
    const item = buildItem(room, index);
    gaEvent('select_item', {
        item_list_id: 'lista_quartos',
        item_list_name: 'Lista de Quartos',
        items: [item],
    });
}

export function trackBeginCheckout(payload: BeginCheckoutPayload) {
    const items = payload.items || [];
    const value = toNumber(payload.value, 0);

    gaEvent('begin_checkout', {
        currency: payload.currency || 'BRL',
        value,
        booking_id: payload.bookingId || undefined,
        items,
    });
}

export function trackPurchase(payload: PurchasePayload) {
    if (!payload.transactionId) return;

    gaEvent('purchase', {
        transaction_id: payload.transactionId,
        currency: payload.currency || 'BRL',
        value: toNumber(payload.value, 0),
        items: payload.items || [],
    });
}

export function trackClickReservar(label: string) {
    gaEvent('click_reservar', {
        event_category: 'engajamento',
        event_label: label,
    });
}

export function trackClickWhatsApp(label: string) {
    gaEvent('click_whatsapp', {
        event_category: 'contato',
        event_label: label,
    });
}

