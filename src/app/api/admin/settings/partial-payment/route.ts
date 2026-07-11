import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminAuth } from '@/lib/admin-auth';
import {
    DEFAULT_PARTIAL_PAYMENT_SETTINGS,
    normalizePartialPaymentSettings,
    validatePartialPaymentSettings,
    type PartialPaymentSettings,
} from '@/lib/partial-payment';

const SETTINGS_ID = 'default';

function serialize(settings: any): PartialPaymentSettings {
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

async function getSettings() {
    const settings = await prisma.partialPaymentSettings.findUnique({
        where: { id: SETTINGS_ID },
    });

    return serialize(settings);
}

export async function GET() {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const settings = await getSettings();
        return NextResponse.json({ settings });
    } catch (error) {
        console.error('[Partial Payment Settings] GET error:', error);
        return NextResponse.json({ error: 'Erro ao carregar configuracoes' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof Response) return auth;

        const body = await request.json().catch(() => ({}));
        const settings = normalizePartialPaymentSettings(body);
        const validation = validatePartialPaymentSettings(settings);

        if (!validation.valid) {
            return NextResponse.json(
                { error: 'Configuracao invalida', errors: validation.errors },
                { status: 400 }
            );
        }

        const saved = await prisma.partialPaymentSettings.upsert({
            where: { id: SETTINGS_ID },
            update: {
                enabled: settings.enabled,
                percentage: settings.percentage,
                minimumBookingAmount: settings.minimumBookingAmount,
                minimumLeadTimeDays: settings.minimumLeadTimeDays,
                balanceDueAt: settings.balanceDueAt,
                balanceDueDaysBeforeCheckIn: settings.balanceDueAt === 'BEFORE_CHECK_IN'
                    ? settings.balanceDueDaysBeforeCheckIn
                    : null,
                defaultPaymentMode: settings.defaultPaymentMode,
            },
            create: {
                id: SETTINGS_ID,
                enabled: settings.enabled,
                percentage: settings.percentage,
                minimumBookingAmount: settings.minimumBookingAmount,
                minimumLeadTimeDays: settings.minimumLeadTimeDays,
                balanceDueAt: settings.balanceDueAt,
                balanceDueDaysBeforeCheckIn: settings.balanceDueAt === 'BEFORE_CHECK_IN'
                    ? settings.balanceDueDaysBeforeCheckIn
                    : null,
                defaultPaymentMode: settings.defaultPaymentMode,
            },
        });

        console.info('[Partial Payment Settings] updated', {
            adminId: 'adminId' in auth ? auth.adminId : null,
            enabled: settings.enabled,
            percentage: settings.percentage,
        });

        return NextResponse.json({ settings: serialize(saved) });
    } catch (error) {
        console.error('[Partial Payment Settings] PUT error:', error);
        return NextResponse.json({ error: 'Erro ao salvar configuracoes' }, { status: 500 });
    }
}
