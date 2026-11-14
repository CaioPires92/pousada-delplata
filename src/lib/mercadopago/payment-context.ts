type PaymentContextInput = {
    bookingId: string;
    roomTypeId: string;
    roomName: string;
    checkIn: Date;
    checkOut: Date;
    adults: number;
    children: number;
    amount: number;
    guestName: string;
    guestPhone?: string | null;
    ipAddress?: string | null;
};

export function splitGuestName(rawName: string) {
    const parts = String(rawName || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    return {
        firstName: parts[0] || undefined,
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
    };
}

export function normalizeBrazilianPhone(rawPhone?: string | null) {
    let digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
    if (digits.length < 10 || digits.length > 11) return undefined;

    return {
        area_code: digits.slice(0, 2),
        number: digits.slice(2),
    };
}

export function buildMercadoPagoPaymentContext(input: PaymentContextInput) {
    const { firstName, lastName } = splitGuestName(input.guestName);
    const phone = normalizeBrazilianPhone(input.guestPhone);
    const nights = Math.max(1, Math.round((input.checkOut.getTime() - input.checkIn.getTime()) / 86_400_000));
    const description = `${input.checkIn.toISOString().slice(0, 10)} a ${input.checkOut.toISOString().slice(0, 10)}; ${input.adults} adulto(s), ${input.children} criança(s)`;

    return {
        payerPhone: phone,
        additionalInfo: {
            ...(input.ipAddress ? { ip_address: input.ipAddress } : {}),
            payer: {
                ...(firstName ? { first_name: firstName } : {}),
                ...(lastName ? { last_name: lastName } : {}),
                ...(phone ? { phone } : {}),
            },
            items: [{
                id: input.roomTypeId || input.bookingId,
                title: `Hospedagem - ${input.roomName}`.slice(0, 120),
                description: `${nights} diária(s); ${description}`.slice(0, 256),
                category_id: 'travels',
                quantity: 1,
                unit_price: input.amount,
                event_date: input.checkIn.toISOString(),
            }],
        },
    };
}

export function getPaymentRejectionMessage(statusDetail: unknown) {
    const detail = String(statusDetail || '').trim().toLowerCase();
    if (['cc_rejected_high_risk', 'cc_rejected_blacklist', 'rejected_high_risk', 'high_risk'].includes(detail)) {
        return 'O pagamento não passou pela análise de segurança. Evite repetir imediatamente com o mesmo cartão; tente Pix ou outro cartão.';
    }
    if (['cc_rejected_insufficient_amount', 'insufficient_amount'].includes(detail)) {
        return 'O cartão não possui limite disponível para esta compra. Tente outro cartão, menos parcelas ou Pix.';
    }
    if (['cc_rejected_call_for_authorize', 'required_call_for_authorize'].includes(detail)) {
        return 'O banco pediu autorização para a compra. Entre em contato com o emissor do cartão e tente novamente depois.';
    }
    if (['cc_rejected_invalid_installments', 'invalid_installments'].includes(detail)) {
        return 'O banco não aceitou a quantidade de parcelas escolhida. Tente menos parcelas ou outro meio de pagamento.';
    }
    if (['cc_rejected_card_disabled', 'card_disabled'].includes(detail)) {
        return 'O cartão está bloqueado para esta compra. Confirme a liberação com o banco ou escolha outro meio de pagamento.';
    }
    if (['cc_rejected_max_attempts', 'max_attempts_exceeded'].includes(detail)) {
        return 'O limite de tentativas foi atingido. Aguarde antes de tentar novamente ou escolha Pix/outro cartão.';
    }
    if (detail === 'cc_rejected_3ds_challenge') {
        return 'A autenticação do banco não foi concluída. Tente novamente e confirme a compra no aplicativo do banco.';
    }
    if (detail === 'cc_rejected_3ds_mandatory') {
        return 'O banco exige autenticação de segurança para esta compra. Tente novamente e conclua a confirmação solicitada pelo banco.';
    }
    if (detail === 'cc_rejected_bad_filled_card_number') {
        return 'O número do cartão foi informado incorretamente. Revise os dados e tente novamente.';
    }
    if (detail === 'cc_rejected_bad_filled_date') {
        return 'A data de validade do cartão está incorreta ou vencida. Revise os dados e tente novamente.';
    }
    if (detail === 'cc_rejected_bad_filled_security_code') {
        return 'O código de segurança do cartão está incorreto. Revise o CVV e tente novamente.';
    }
    if (['cc_rejected_bad_filled_other', 'bad_filled_card_data', 'rejected_insufficient_data'].includes(detail)) {
        return 'Alguns dados do pagamento estão incorretos ou incompletos. Revise as informações e tente novamente.';
    }
    if (detail === 'cc_rejected_duplicated_payment') {
        return 'O banco identificou uma cobrança de mesmo valor já realizada. Confira seus pagamentos ou tente outro meio de pagamento.';
    }
    if (detail === 'cc_rejected_time_out') {
        return 'O banco não respondeu dentro do prazo. Aguarde alguns minutos e tente novamente.';
    }
    if (detail === 'cc_amount_rate_limit_exceeded') {
        return 'O meio de pagamento atingiu o limite permitido para esta transação. Tente outro cartão ou Pix.';
    }
    if (detail === 'cc_rejected_card_type_not_allowed') {
        return 'A função crédito não está habilitada neste cartão. Use outro cartão ou escolha Pix.';
    }
    if (['rejected_by_bank', 'rejected_by_issuer'].includes(detail)) {
        return 'O pagamento foi recusado pelo banco emissor. Entre em contato com o banco ou tente outro meio de pagamento.';
    }
    if (detail === 'rejected_by_regulations') {
        return 'O pagamento foi recusado por regras regulatórias. Tente outro meio de pagamento ou fale com o banco.';
    }
    if (detail === 'rejected_by_biz_rule') {
        return 'O pagamento não atende às regras desta operação. Tente outro meio de pagamento.';
    }
    if (['cc_rejected_other_reason', 'rejected_other_reason'].includes(detail)) {
        return 'O banco não informou o motivo exato da recusa. Tente outro cartão, Pix ou entre em contato com o banco.';
    }
    return 'Pagamento não aprovado. Revise os dados ou tente Pix/outro cartão.';
}

export function isRetryablePaymentRejection(status: unknown) {
    return String(status || '').trim().toUpperCase() === 'REJECTED';
}

export function validateApprovedPaymentAmount(input: {
    status: unknown;
    transactionAmount: unknown;
    currencyId: unknown;
    expectedAmount: unknown;
}) {
    if (String(input.status || '').trim().toLowerCase() !== 'approved') {
        return { ok: true as const };
    }

    const transactionAmount = Number(input.transactionAmount);
    const expectedAmount = Number(input.expectedAmount);
    const currencyId = String(input.currencyId || '').trim().toUpperCase();

    if (currencyId !== 'BRL') {
        return { ok: false as const, reason: 'currency_mismatch' as const };
    }
    if (!Number.isFinite(transactionAmount) || !Number.isFinite(expectedAmount)) {
        return { ok: false as const, reason: 'invalid_amount' as const };
    }
    if (Math.abs(transactionAmount - expectedAmount) > 0.01) {
        return { ok: false as const, reason: 'amount_mismatch' as const };
    }

    return { ok: true as const };
}

export function getPolledBookingPaymentStatus(input: {
    bookingStatus: unknown;
    paymentStatus: unknown;
}) {
    const bookingStatus = String(input.bookingStatus || '').trim().toUpperCase();
    const paymentStatus = String(input.paymentStatus || '').trim().toUpperCase();

    if (bookingStatus === 'CONFIRMED' || paymentStatus === 'APPROVED') return 'APPROVED' as const;
    if (paymentStatus === 'REJECTED') return 'REJECTED' as const;
    if (bookingStatus === 'CANCELLED' || ['CANCELLED', 'REFUNDED', 'CHARGED_BACK'].includes(paymentStatus)) {
        return 'CANCELLED' as const;
    }
    return 'PENDING' as const;
}

export function mapMercadoPagoPaymentStatus(status: unknown) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved') {
        return { bookingStatus: 'CONFIRMED', paymentStatus: 'APPROVED' } as const;
    }
    if (isRetryablePaymentRejection(normalized)) {
        return { bookingStatus: 'PENDING', paymentStatus: 'REJECTED' } as const;
    }
    if (normalized === 'cancelled') {
        return { bookingStatus: 'CANCELLED', paymentStatus: 'REJECTED' } as const;
    }
    if (normalized === 'refunded' || normalized === 'charged_back') {
        return { bookingStatus: 'CANCELLED', paymentStatus: 'REFUNDED' } as const;
    }
    return { bookingStatus: 'PENDING', paymentStatus: 'PENDING' } as const;
}
