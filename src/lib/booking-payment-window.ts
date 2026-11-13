import type { Prisma } from '@prisma/client';

import { PAYMENT_UNDER_REVIEW_STATUSES, PAYMENT_UNDER_REVIEW_WINDOW_MS } from '@/lib/mercadopago/payment-under-review';

// Regras de tempo de uma reserva pendente (mesma regra do Refúgio Serrano, adaptada ao MP):
// - PRAZO DE PAGAMENTO: o link/preferência do Mercado Pago (site ou link do admin) vence nesse horário.
// - BLOQUEIO DO QUARTO: dura o prazo + uma folga. Um pagamento que chega atrasado (Pix gerado
//   no último minuto, cartão demorando) ainda encontra o quarto reservado: sem overbooking.
// - Depois do bloqueio a reserva deixa de valer mesmo que o cron ainda não tenha mudado o status
//   para EXPIRED (o cron só arruma a casa e envia o e-mail de "reserva expirada").
// O admin renova o prazo ao gerar um novo link de pagamento (Booking.paymentDeadlineAt).

const MINUTE_MS = 60 * 1000;

// Abaixo disso não vale abrir pagamento: não dá tempo de preencher cartão ou pagar o Pix.
export const MIN_CHECKOUT_MINUTES = 10;

// O Mercado Pago exige que o Pix vença no mínimo 30 minutos depois de emitido.
export const PIX_MIN_VALIDITY_MS = 30 * MINUTE_MS;

export function getPaymentWindowMinutes() {
    const configured = Number.parseInt(process.env.PENDING_BOOKING_PAYMENT_WINDOW_MINUTES || '60', 10);
    return Math.max(MIN_CHECKOUT_MINUTES + 5, Number.isFinite(configured) && configured > 0 ? configured : 60);
}

// Folga do bloqueio do quarto depois que o link de pagamento vence. Nunca menor que a validade
// mínima do Pix, para um Pix emitido no fim do prazo ainda cair dentro do bloqueio.
export function getRoomHoldGraceMinutes() {
    const configured = Number.parseInt(process.env.PENDING_BOOKING_HOLD_GRACE_MINUTES || '60', 10);
    return Math.max(PIX_MIN_VALIDITY_MS / MINUTE_MS + 5, Number.isFinite(configured) && configured > 0 ? configured : 60);
}

export function getPaymentDeadline(booking: { createdAt: Date; paymentDeadlineAt?: Date | null }) {
    if (booking.paymentDeadlineAt) return new Date(booking.paymentDeadlineAt);
    return new Date(new Date(booking.createdAt).getTime() + getPaymentWindowMinutes() * MINUTE_MS);
}

export function getRoomHoldEnd(booking: { createdAt: Date; paymentDeadlineAt?: Date | null }) {
    return new Date(getPaymentDeadline(booking).getTime() + getRoomHoldGraceMinutes() * MINUTE_MS);
}

export function getNewPaymentDeadline(now = new Date()) {
    return new Date(now.getTime() + getPaymentWindowMinutes() * MINUTE_MS);
}

export type BookingPaymentWindow =
    | { open: true; deadline: Date; minutesToExpire: number }
    | { open: false; reason: 'BOOKING_NOT_PENDING' | 'PAYMENT_WINDOW_CLOSED' };

export function getBookingPaymentWindow(
    booking: { status: string; createdAt: Date; paymentDeadlineAt?: Date | null },
    now = new Date(),
): BookingPaymentWindow {
    if (String(booking.status || '').toUpperCase() !== 'PENDING') {
        return { open: false, reason: 'BOOKING_NOT_PENDING' };
    }
    const deadline = getPaymentDeadline(booking);
    const minutesLeft = Math.floor((deadline.getTime() - now.getTime()) / MINUTE_MS);
    if (!Number.isFinite(minutesLeft) || minutesLeft < MIN_CHECKOUT_MINUTES) {
        return { open: false, reason: 'PAYMENT_WINDOW_CLOSED' };
    }
    return { open: true, deadline, minutesToExpire: minutesLeft };
}

export const PAYMENT_WINDOW_MESSAGES = {
    BOOKING_NOT_PENDING: 'Esta reserva não está mais aguardando pagamento.',
    PAYMENT_WINDOW_CLOSED: 'O prazo para pagar esta reserva terminou. Faça uma nova reserva ou fale com a gente no WhatsApp.',
} as const;

// Formato aceito pelo MP (yyyy-MM-ddTHH:mm:ss.SSS-03:00). Brasília não tem horário de verão desde 2019.
export function formatMercadoPagoDate(date: Date) {
    return new Date(date.getTime() - 3 * 60 * MINUTE_MS).toISOString().replace('Z', '-03:00');
}

// Vencimento do Pix: prazo da reserva + 30 min. Como nenhum Pix é emitido depois do prazo
// (link/pagamento fecham nele), sempre sobram os 30 min mínimos exigidos pelo MP, e o vencimento
// cai dentro do bloqueio do quarto (prazo + folga >= 35 min). Determinístico (sem "agora"),
// para a chave de idempotência da preferência não mudar a cada clique.
export function getPixExpiration(deadline: Date) {
    return new Date(deadline.getTime() + PIX_MIN_VALIDITY_MS);
}

// Campos da preferência do Checkout Pro: o link só aceita pagamento até o prazo da reserva.
export function buildPreferenceExpirationFields(deadline: Date) {
    return {
        expires: true,
        expiration_date_from: formatMercadoPagoDate(new Date(deadline.getTime() - getPaymentWindowMinutes() * MINUTE_MS)),
        expiration_date_to: formatMercadoPagoDate(deadline),
        date_of_expiration: formatMercadoPagoDate(getPixExpiration(deadline)),
    };
}

function underReviewAttemptWhere(now: Date): Prisma.PaymentAttemptListRelationFilter {
    return {
        some: {
            status: { in: PAYMENT_UNDER_REVIEW_STATUSES },
            updatedAt: { gte: new Date(now.getTime() - PAYMENT_UNDER_REVIEW_WINDOW_MS) },
        },
    };
}

// Reservas que ocupam o quarto: confirmadas/pagas, pendentes dentro do bloqueio (prazo + folga)
// e pendentes com cartão em análise. Usar em TODA contagem de estoque (site, cotação, painel).
export function occupyingBookingWhere(now = new Date()): Prisma.BookingWhereInput {
    const graceMs = getRoomHoldGraceMinutes() * MINUTE_MS;
    const holdStart = new Date(now.getTime() - getPaymentWindowMinutes() * MINUTE_MS - graceMs);
    return {
        OR: [
            { status: { in: ['CONFIRMED', 'PAID'] } },
            {
                status: 'PENDING',
                OR: [
                    { paymentDeadlineAt: { gt: new Date(now.getTime() - graceMs) } },
                    { paymentDeadlineAt: null, createdAt: { gt: holdStart } },
                    { paymentAttempts: underReviewAttemptWhere(now) },
                ],
            },
        ],
    };
}

// Pendentes cujo bloqueio acabou (candidatas à expiração pelo cron). As com cartão em
// análise são filtradas depois, pelo histórico de tentativas.
export function pastHoldPendingWhere(now = new Date()): Prisma.BookingWhereInput {
    const graceMs = getRoomHoldGraceMinutes() * MINUTE_MS;
    const holdStart = new Date(now.getTime() - getPaymentWindowMinutes() * MINUTE_MS - graceMs);
    return {
        status: 'PENDING',
        OR: [
            { paymentDeadlineAt: { lte: new Date(now.getTime() - graceMs) } },
            { paymentDeadlineAt: null, createdAt: { lte: holdStart } },
        ],
    };
}
