export type PaymentMode = 'FULL' | 'PARTIAL';
export type BalanceDueAt = 'CHECK_IN' | 'BEFORE_CHECK_IN';

export interface PartialPaymentSettings {
    enabled: boolean;
    percentage: number;
    minimumBookingAmount: number | null;
    minimumLeadTimeDays: number | null;
    balanceDueAt: BalanceDueAt;
    balanceDueDaysBeforeCheckIn: number | null;
    defaultPaymentMode: PaymentMode;
}

export interface PartialPaymentEvaluation {
    settings: PartialPaymentSettings;
    eligible: boolean;
    reasons: string[];
    fullAmount: number;
    partialAmount: number;
    remainingAmount: number;
    defaultPaymentMode: PaymentMode;
    balanceDueAt: BalanceDueAt;
    balanceDueDate: Date | null;
}

export const DEFAULT_PARTIAL_PAYMENT_SETTINGS: PartialPaymentSettings = {
    enabled: false,
    percentage: 50,
    minimumBookingAmount: null,
    minimumLeadTimeDays: null,
    balanceDueAt: 'CHECK_IN',
    balanceDueDaysBeforeCheckIn: null,
    defaultPaymentMode: 'FULL',
};

export function roundCurrency(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeOptionalNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function normalizeOptionalInteger(value: unknown) {
    const parsed = normalizeOptionalNumber(value);
    if (parsed === null) return null;
    return Math.floor(parsed);
}

export function normalizePartialPaymentSettings(input: Partial<PartialPaymentSettings> | null | undefined): PartialPaymentSettings {
    const percentage = Number.parseInt(String(input?.percentage ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.percentage), 10);
    const balanceDueAt = input?.balanceDueAt === 'BEFORE_CHECK_IN' ? 'BEFORE_CHECK_IN' : 'CHECK_IN';
    const defaultPaymentMode = input?.defaultPaymentMode === 'PARTIAL' ? 'PARTIAL' : 'FULL';

    return {
        enabled: Boolean(input?.enabled),
        percentage: Number.isFinite(percentage) ? percentage : DEFAULT_PARTIAL_PAYMENT_SETTINGS.percentage,
        minimumBookingAmount: normalizeOptionalNumber(input?.minimumBookingAmount),
        minimumLeadTimeDays: normalizeOptionalInteger(input?.minimumLeadTimeDays),
        balanceDueAt,
        balanceDueDaysBeforeCheckIn: normalizeOptionalInteger(input?.balanceDueDaysBeforeCheckIn),
        defaultPaymentMode,
    };
}

export function validatePartialPaymentSettings(settings: PartialPaymentSettings) {
    const errors: Record<string, string> = {};

    if (!Number.isInteger(settings.percentage) || settings.percentage < 1 || settings.percentage > 99) {
        errors.percentage = 'Informe um percentual inteiro entre 1 e 99.';
    }

    if (settings.minimumBookingAmount !== null && settings.minimumBookingAmount < 0) {
        errors.minimumBookingAmount = 'O valor minimo nao pode ser negativo.';
    }

    if (settings.minimumLeadTimeDays !== null && settings.minimumLeadTimeDays < 0) {
        errors.minimumLeadTimeDays = 'A antecedencia minima nao pode ser negativa.';
    }

    if (settings.balanceDueAt === 'BEFORE_CHECK_IN') {
        if (settings.balanceDueDaysBeforeCheckIn === null || settings.balanceDueDaysBeforeCheckIn < 0) {
            errors.balanceDueDaysBeforeCheckIn = 'Informe quantos dias antes do check-in o saldo sera cobrado.';
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
}

export function calculateLeadTimeDays(checkIn: Date, now = new Date()) {
    const checkInDay = Date.UTC(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((checkInDay - nowDay) / (24 * 60 * 60 * 1000));
}

export function calculateBalanceDueDate(params: {
    checkIn: Date;
    balanceDueAt: BalanceDueAt;
    balanceDueDaysBeforeCheckIn: number | null;
}) {
    if (params.balanceDueAt !== 'BEFORE_CHECK_IN') return null;
    const days = Math.max(0, params.balanceDueDaysBeforeCheckIn ?? 0);
    return new Date(params.checkIn.getTime() - days * 24 * 60 * 60 * 1000);
}

export function evaluatePartialPaymentEligibility(params: {
    settings: PartialPaymentSettings;
    totalAmount: number;
    checkIn: Date;
    now?: Date;
}): PartialPaymentEvaluation {
    const settings = normalizePartialPaymentSettings(params.settings);
    const fullAmount = roundCurrency(params.totalAmount);
    const partialAmount = roundCurrency(fullAmount * (settings.percentage / 100));
    const remainingAmount = roundCurrency(fullAmount - partialAmount);
    const reasons: string[] = [];

    if (!settings.enabled) {
        reasons.push('disabled');
    }

    if (settings.minimumBookingAmount !== null && fullAmount < settings.minimumBookingAmount) {
        reasons.push('below_minimum_amount');
    }

    const leadTimeDays = calculateLeadTimeDays(params.checkIn, params.now);
    if (settings.minimumLeadTimeDays !== null && leadTimeDays < settings.minimumLeadTimeDays) {
        reasons.push('below_minimum_lead_time');
    }

    const eligible = reasons.length === 0;
    const balanceDueDate = calculateBalanceDueDate({
        checkIn: params.checkIn,
        balanceDueAt: settings.balanceDueAt,
        balanceDueDaysBeforeCheckIn: settings.balanceDueDaysBeforeCheckIn,
    });

    return {
        settings,
        eligible,
        reasons,
        fullAmount,
        partialAmount,
        remainingAmount,
        defaultPaymentMode: eligible ? settings.defaultPaymentMode : 'FULL',
        balanceDueAt: settings.balanceDueAt,
        balanceDueDate,
    };
}

export function calculatePaymentPlan(params: {
    settings: PartialPaymentSettings;
    totalAmount: number;
    checkIn: Date;
    paymentMode: PaymentMode;
    now?: Date;
}) {
    const evaluation = evaluatePartialPaymentEligibility(params);
    const paymentMode = params.paymentMode === 'PARTIAL' && evaluation.eligible ? 'PARTIAL' : 'FULL';

    if (params.paymentMode === 'PARTIAL' && !evaluation.eligible) {
        return {
            ok: false as const,
            evaluation,
            error: 'partial_payment_not_allowed',
        };
    }

    return {
        ok: true as const,
        evaluation,
        paymentMode,
        amountDueNow: paymentMode === 'PARTIAL' ? evaluation.partialAmount : evaluation.fullAmount,
        remainingAmount: paymentMode === 'PARTIAL' ? evaluation.remainingAmount : 0,
        balanceDueAt: paymentMode === 'PARTIAL' ? evaluation.balanceDueAt : null,
        balanceDueDate: paymentMode === 'PARTIAL' ? evaluation.balanceDueDate : null,
    };
}
