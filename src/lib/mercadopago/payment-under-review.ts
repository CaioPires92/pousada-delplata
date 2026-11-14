import prisma from '@/lib/prisma';
import { opsLog } from '@/lib/ops-log';

// Status do MP (em maiúsculas, como gravados em PaymentAttempt) de cartão ainda em análise.
export const PAYMENT_UNDER_REVIEW_STATUSES = ['IN_PROCESS', 'AUTHORIZED'];
// Janela da análise manual do MP: depois dela, uma tentativa sem atualização (webhook perdido)
// deixa de travar a reserva.
export const PAYMENT_UNDER_REVIEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export async function hasPaymentUnderReview(bookingId: string) {
    try {
        const attempt = await prisma.paymentAttempt.findFirst({
            where: {
                bookingId,
                status: { in: PAYMENT_UNDER_REVIEW_STATUSES },
                updatedAt: { gte: new Date(Date.now() - PAYMENT_UNDER_REVIEW_WINDOW_MS) },
            },
            select: { id: true },
        });
        return Boolean(attempt);
    } catch (error) {
        // Mesmo critério do webhook: sem a tabela de histórico, segue sem a verificação.
        opsLog('warn', 'MP_HOSTED_CHECKOUT_REVIEW_CHECK_FAILED', {
            bookingIdShort: bookingId.slice(0, 8),
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
        const attempts = await prisma.paymentAttempt.findMany({
            where: {
                bookingId: { in: bookingIds },
                status: { in: PAYMENT_UNDER_REVIEW_STATUSES },
                updatedAt: { gte: new Date(Date.now() - PAYMENT_UNDER_REVIEW_WINDOW_MS) },
            },
            select: { bookingId: true },
        });
        return new Set(attempts.map((attempt) => attempt.bookingId));
    } catch (error) {
        opsLog('warn', 'PAYMENT_UNDER_REVIEW_BATCH_CHECK_FAILED', {
            count: bookingIds.length,
            message: error instanceof Error ? error.name : 'unknown',
        });
        return new Set(bookingIds);
    }
}
