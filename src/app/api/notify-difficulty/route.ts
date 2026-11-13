import { NextResponse } from 'next/server';
import { normalizeSingleEmailAddress, sendDifficultyAlertEmail } from '@/lib/email';
import { consumeRequestLimit, readJsonBody, RequestGuardError } from '@/lib/request-guard';

export const runtime = 'nodejs';

const text = (value: unknown, maxLength: number) =>
    (typeof value === 'string' ? value.trim().slice(0, maxLength) : '');

export async function POST(request: Request) {
    try {
        const body = await readJsonBody<Record<string, unknown>>(request, 8 * 1024);
        const guestName = text(body.guestName, 120);
        const guestEmail = normalizeSingleEmailAddress(body.guestEmail);
        const guestPhone = text(body.guestPhone, 32);
        const step = text(body.step, 80);
        const reason = text(body.reason, 500);
        const bookingId = text(body.bookingId, 128);
        const roomName = text(body.roomName, 160);
        const error = text(body.error, 500);
        const funnelStage = text(body.funnelStage, 80);
        const cardBrand = text(body.cardBrand, 40);
        const paymentStatusDetail = text(body.paymentStatusDetail, 120);
        const paymentMethodId = text(body.paymentMethodId, 80);
        const paymentTypeId = text(body.paymentTypeId, 80);
        const paymentProviderId = text(body.paymentProviderId, 128);
        const cardLastFour = /^\d{4}$/.test(text(body.cardLastFour, 4)) ? text(body.cardLastFour, 4) : '';
        const totalPrice = typeof body.totalPrice === 'number' && Number.isFinite(body.totalPrice)
            ? body.totalPrice
            : undefined;
        const installments = Number.isInteger(body.installments) && Number(body.installments) > 0
            ? Number(body.installments)
            : undefined;

        if (!guestName || !guestEmail || !step || !reason) {
            return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
        }

        const rateLimit = consumeRequestLimit({
            request,
            scope: 'notify-difficulty',
            discriminator: bookingId || guestEmail.toLowerCase(),
            limit: 3,
            windowMs: 15 * 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'TOO_MANY_EMAIL_REQUESTS' }, {
                status: 429,
                headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
            });
        }

        const result = await sendDifficultyAlertEmail({
            guestName,
            guestEmail,
            guestPhone,
            step,
            reason,
            bookingId,
            roomName,
            totalPrice,
            error,
            funnelStage,
            cardBrand,
            paymentStatusDetail,
            paymentMethodId,
            paymentTypeId,
            paymentProviderId,
            cardLastFour,
            installments,
        });

        if (!result.success) {
            return NextResponse.json({ error: 'Falha ao enviar email' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof RequestGuardError) {
            return NextResponse.json({ error: error.code }, { status: error.status });
        }
        console.error('Falha ao processar alerta de dificuldade.');
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
