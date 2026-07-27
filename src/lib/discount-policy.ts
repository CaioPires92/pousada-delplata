export type DiscountBlockedDateRange = {
    start: string;
    end: string;
    label: string;
};

export type DiscountPolicy = {
    sendEnabled: boolean;
    percentage: number;
    validityDays: number;
    minimumBookingValue: number | null;
    maximumDiscountAmount: number | null;
    blockedDateRanges: DiscountBlockedDateRange[];
};

export const DEFAULT_DISCOUNT_POLICY: DiscountPolicy = {
    sendEnabled: true,
    percentage: 10,
    validityDays: 7,
    minimumBookingValue: null,
    maximumDiscountAmount: null,
    blockedDateRanges: [],
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
    if (!ISO_DATE_PATTERN.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeOptionalAmount(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : Number.NaN;
}

export function parseBlockedDateRanges(value: unknown): DiscountBlockedDateRange[] {
    let input = value;
    if (typeof value === 'string') {
        try {
            input = JSON.parse(value);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(input)) return [];

    return input
        .map((item) => ({
            start: String(item?.start || '').trim(),
            end: String(item?.end || '').trim(),
            label: String(item?.label || '').trim().slice(0, 80),
        }))
        .filter((item) => isValidIsoDate(item.start) && isValidIsoDate(item.end) && item.start <= item.end);
}

export function normalizeDiscountPolicy(input: Partial<DiscountPolicy> | null | undefined): DiscountPolicy {
    return {
        sendEnabled: input?.sendEnabled === undefined ? DEFAULT_DISCOUNT_POLICY.sendEnabled : Boolean(input.sendEnabled),
        percentage: Number(input?.percentage ?? DEFAULT_DISCOUNT_POLICY.percentage),
        validityDays: Number(input?.validityDays ?? DEFAULT_DISCOUNT_POLICY.validityDays),
        minimumBookingValue: normalizeOptionalAmount(input?.minimumBookingValue),
        maximumDiscountAmount: normalizeOptionalAmount(input?.maximumDiscountAmount),
        blockedDateRanges: parseBlockedDateRanges(input?.blockedDateRanges),
    };
}

export function validateDiscountPolicy(policy: DiscountPolicy) {
    const errors: Record<string, string> = {};
    if (!Number.isInteger(policy.percentage) || policy.percentage < 1 || policy.percentage > 50) {
        errors.percentage = 'O percentual deve estar entre 1% e 50%.';
    }
    if (!Number.isInteger(policy.validityDays) || policy.validityDays < 1 || policy.validityDays > 365) {
        errors.validityDays = 'A validade deve estar entre 1 e 365 dias.';
    }
    if (Number.isNaN(policy.minimumBookingValue) || Number(policy.minimumBookingValue) < 0) {
        errors.minimumBookingValue = 'O valor mínimo deve ser zero ou maior.';
    }
    if (Number.isNaN(policy.maximumDiscountAmount) || Number(policy.maximumDiscountAmount) < 0) {
        errors.maximumDiscountAmount = 'O limite de desconto deve ser zero ou maior.';
    }
    if (policy.blockedDateRanges.length > 100) {
        errors.blockedDateRanges = 'Cadastre no máximo 100 períodos bloqueados.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
}

export function stayOverlapsBlockedRange(params: {
    checkIn?: Date | string | null;
    checkOut?: Date | string | null;
    blockedDateRanges: DiscountBlockedDateRange[];
}) {
    if (!params.checkIn || !params.checkOut) return false;
    const checkIn = new Date(typeof params.checkIn === 'string' && ISO_DATE_PATTERN.test(params.checkIn)
        ? `${params.checkIn}T00:00:00.000Z`
        : params.checkIn);
    const checkOut = new Date(typeof params.checkOut === 'string' && ISO_DATE_PATTERN.test(params.checkOut)
        ? `${params.checkOut}T00:00:00.000Z`
        : params.checkOut);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) return false;

    return params.blockedDateRanges.some((range) => {
        const start = new Date(`${range.start}T00:00:00.000Z`);
        const endExclusive = new Date(`${range.end}T00:00:00.000Z`);
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
        return checkIn < endExclusive && checkOut > start;
    });
}
