import type { Booking } from './types';

const BRAND_ALIASES: Record<string, string> = {
    MASTERCARD: 'MASTER',
    AMERICAN_EXPRESS: 'AMEX',
};

const KNOWN_BRANDS = new Set([
    'VISA',
    'MASTER',
    'ELO',
    'AMEX',
    'HIPERCARD',
    'MAESTRO',
    'CABAL',
    'NARANJA',
]);

function parseDateSafe(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateSafe(value?: string | null) {
    const parsed = parseDateSafe(value);
    if (!parsed) return '-';
    const ymd = parsed.toISOString().slice(0, 10);
    const [year, month, day] = ymd.split('-');
    return `${day}/${month}/${year}`;
}

function normalizeBrand(value?: string | null) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    const normalized = raw.replace(/[\s-]+/g, '_');
    return BRAND_ALIASES[normalized] || normalized;
}

export function formatPaymentType(method?: string | null) {
    const normalized = String(method || '').trim().toUpperCase();
    if (!normalized) return '-';
    if (KNOWN_BRANDS.has(normalizeBrand(normalized))) return 'Crédito';

    const labels: Record<string, string> = {
        PIX: 'Pix',
        CREDIT_CARD: 'Crédito',
        DEBIT_CARD: 'Débito',
        ACCOUNT_MONEY: 'Saldo MP',
    };
    return labels[normalized] || normalized.replace(/_/g, ' ');
}

export function formatCurrency(value: number) {
    return `R$ ${Number(value || 0).toFixed(2)}`;
}

export function getStatusText(status: string) {
    const normalized = String(status || '').toUpperCase();
    const texts: Record<string, string> = {
        PENDING: 'Pendente',
        CONFIRMED: 'Confirmada',
        CANCELLED: 'Cancelada',
        EXPIRED: 'Expirada',
        REFUNDED: 'Estornada',
        PAID: 'Paga',
        COMPLETED: 'Concluída',
    };
    return texts[normalized] || normalized || '-';
}

export function getBookingOperationalDate(booking: Booking) {
    return booking.checkIn || booking.createdAt || null;
}

export function getBookingCheckOutDate(booking: Booking) {
    return booking.checkOut || null;
}

export function getBookingGuestsLabel(booking: Booking) {
    const adults = Number(booking.adults || 0);
    const children = Number(booking.children || 0);
    const total = adults + children;
    return `${total} hósp. (${adults}A/${children}C)`;
}

export function normalizeChildrenAges(childrenAges?: string | null) {
    const raw = String(childrenAges || '').trim();
    if (!raw) return [] as number[];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((age) => Number.parseInt(String(age), 10))
                .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
        }
    } catch {
        // fallback CSV
    }

    return raw
        .split(',')
        .map((age) => Number.parseInt(age.trim(), 10))
        .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17);
}

function getPaymentBrand(payment?: Booking['payment']) {
    const explicitBrand = normalizeBrand(payment?.cardBrand);
    if (explicitBrand) return explicitBrand;

    const method = normalizeBrand(payment?.method);
    if (KNOWN_BRANDS.has(method)) return method;
    return '';
}

export function formatPaymentBrand(payment?: Booking['payment']) {
    const brand = getPaymentBrand(payment);
    if (!brand) return '-';

    const labels: Record<string, string> = {
        MASTER: 'Master',
        VISA: 'Visa',
        ELO: 'Elo',
        AMEX: 'Amex',
        HIPERCARD: 'Hipercard',
        MAESTRO: 'Maestro',
        CABAL: 'Cabal',
        NARANJA: 'Naranja',
    };

    return labels[brand] || brand;
}

function isCreditPayment(payment?: Booking['payment']) {
    const method = String(payment?.method || '').trim().toUpperCase();
    if (method === 'CREDIT_CARD') return true;
    if (Number(payment?.installments || 0) > 0) return true;
    return Boolean(getPaymentBrand(payment));
}

export function formatInstallments(payment?: Booking['payment']) {
    if (!isCreditPayment(payment)) return '-';
    const installments = Number.parseInt(String(payment?.installments ?? ''), 10);
    if (!Number.isFinite(installments) || installments <= 0) return '-';
    return `${installments}x`;
}

export function isBookingApproved(booking: Booking) {
    return String(booking.status || '').toUpperCase() === 'CONFIRMED'
        && String(booking.payment?.status || '').toUpperCase() === 'APPROVED';
}
