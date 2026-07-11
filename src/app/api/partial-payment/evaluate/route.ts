import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    DEFAULT_PARTIAL_PAYMENT_SETTINGS,
    evaluatePartialPaymentEligibility,
    normalizePartialPaymentSettings,
} from '@/lib/partial-payment';

const SETTINGS_ID = 'default';

function parseAmount(value: string | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeSettings(settings: any) {
    return normalizePartialPaymentSettings({
        enabled: settings?.enabled ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.enabled,
        percentage: settings?.percentage ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.percentage,
        minimumBookingAmount: settings?.minimumBookingAmount == null ? null : Number(settings.minimumBookingAmount),
        minimumLeadTimeDays: settings?.minimumLeadTimeDays ?? null,
        balanceDueAt: settings?.balanceDueAt ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.balanceDueAt,
        balanceDueDaysBeforeCheckIn: settings?.balanceDueDaysBeforeCheckIn ?? null,
        defaultPaymentMode: settings?.defaultPaymentMode ?? DEFAULT_PARTIAL_PAYMENT_SETTINGS.defaultPaymentMode,
    });
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const totalAmount = parseAmount(url.searchParams.get('totalAmount'));
        const checkIn = parseDate(url.searchParams.get('checkIn'));

        if (totalAmount === null || !checkIn) {
            return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
        }

        const settingsRow = await prisma.partialPaymentSettings.findUnique({
            where: { id: SETTINGS_ID },
        });
        const settings = serializeSettings(settingsRow);
        const evaluation = evaluatePartialPaymentEligibility({
            settings,
            totalAmount,
            checkIn,
        });

        return NextResponse.json({
            enabled: settings.enabled,
            eligible: evaluation.eligible,
            reasons: evaluation.reasons,
            defaultPaymentMode: evaluation.defaultPaymentMode,
            percentage: settings.percentage,
            fullAmount: evaluation.fullAmount,
            partialAmount: evaluation.partialAmount,
            remainingAmount: evaluation.remainingAmount,
            balanceDueAt: evaluation.balanceDueAt,
            balanceDueDate: evaluation.balanceDueDate?.toISOString() ?? null,
        });
    } catch (error) {
        console.error('[Partial Payment Evaluate] GET error:', error);
        return NextResponse.json({ error: 'Erro ao avaliar pagamento parcial' }, { status: 500 });
    }
}
