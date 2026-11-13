import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';

// Status do MP (em maiúsculas, como gravados em PaymentAttempt) de cartão ainda em análise.
export const PAYMENT_UNDER_REVIEW_STATUSES = ['IN_PROCESS', 'AUTHORIZED'];
// Status gravado em Payment pelo webhook do Asaas (PAYMENT_AWAITING_RISK_ANALYSIS).
export const PAYMENT_STATUS_UNDER_REVIEW = 'UNDER_REVIEW';
// Janela da análise manual (MP ou Asaas): depois dela, uma tentativa sem atualização
// (webhook perdido) deixa de travar a reserva.
export const PAYMENT_UNDER_REVIEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

// Versão síncrona para quem já tem o Payment carregado (webhook do Asaas).
export function isPaymentUnderReview(
    payment: { status?: string | null; updatedAt?: Date | null } | null | undefined,
    now = Date.now(),
) {
    if (String(payment?.status || '').toUpperCase() !== PAYMENT_STATUS_UNDER_REVIEW) return false;
    const updatedAt = payment?.updatedAt ? new Date(payment.updatedAt).getTime() : now;
    return now - updatedAt < PAYMENT_UNDER_REVIEW_WINDOW_MS;
}

function reviewWindowStart() {
    return new Date(Date.now() - PAYMENT_UNDER_REVIEW_WINDOW_MS);
}

// Cartão em análise em qualquer provedor: tentativa do MP (histórico em PaymentAttempt)
// ou pagamento do Asaas (Payment.status = UNDER_REVIEW). Cada fonte falha sozinha: sem a
// tabela de histórico do MP, a verificação do Asaas continua valendo (e vice-versa).
export async function hasPaymentUnderReview(bookingId: string) {
    const since = reviewWindowStart();
    const bookingIdShort = bookingId.slice(0, 8);
    try {
        const attempt = await prisma.paymentAttempt.findFirst({
            where: { bookingId, status: { in: PAYMENT_UNDER_REVIEW_STATUSES }, updatedAt: { gte: since } },
            select: { id: true },
        });
        if (attempt) return true;
    } catch (error) {
        opsLog('warn', 'MP_HOSTED_CHECKOUT_REVIEW_CHECK_FAILED', {
            bookingIdShort,
            message: error instanceof Error ? error.name : 'unknown',
        });
    }
    try {
        const payment = await prisma.payment.findFirst({
            where: { bookingId, status: PAYMENT_STATUS_UNDER_REVIEW, updatedAt: { gte: since } },
            select: { id: true },
        });
        return Boolean(payment);
    } catch (error) {
        opsLog('warn', 'ASAAS_REVIEW_CHECK_FAILED', {
            bookingIdShort,
            message: error instanceof Error ? error.name : 'unknown',
        });
        return false;
    }
}

// Versão em lote para rotinas (expiração, e-mails de recuperação). Em caso de falha da
// consulta, trata todas como "em análise": é mais seguro adiar do que expirar por engano.
export async function findBookingIdsWithPaymentUnderReview(bookingIds: string[]) {
    if (bookingIds.length === 0) return new Set<string>();
    try {
        const since = reviewWindowStart();
        const [attempts, payments] = await Promise.all([
            prisma.paymentAttempt.findMany({
                where: { bookingId: { in: bookingIds }, status: { in: PAYMENT_UNDER_REVIEW_STATUSES }, updatedAt: { gte: since } },
                select: { bookingId: true },
            }),
            prisma.payment.findMany({
                where: { bookingId: { in: bookingIds }, status: PAYMENT_STATUS_UNDER_REVIEW, updatedAt: { gte: since } },
                select: { bookingId: true },
            }),
        ]);
        return new Set([...attempts, ...payments].map((row) => row.bookingId));
    } catch (error) {
        opsLog('warn', 'PAYMENT_UNDER_REVIEW_BATCH_CHECK_FAILED', {
            count: bookingIds.length,
            message: error instanceof Error ? error.name : 'unknown',
        });
        return new Set(bookingIds);
    }
}
