import { describe, expect, it } from 'vitest';

import {
    buildMercadoPagoPaymentContext,
    getPolledBookingPaymentStatus,
    getPaymentRejectionMessage,
    isRetryablePaymentRejection,
    mapMercadoPagoPaymentStatus,
    normalizeBrazilianPhone,
    validateApprovedPaymentAmount,
} from './payment-context';

describe('Mercado Pago payment context', () => {
    it('normalizes a Brazilian phone with country code', () => {
        expect(normalizeBrazilianPhone('+55 (19) 99900-2288')).toEqual({
            area_code: '19',
            number: '999002288',
        });
    });

    it('builds payer and lodging item details from trusted booking data', () => {
        const context = buildMercadoPagoPaymentContext({
            bookingId: 'booking-1',
            roomTypeId: 'room-1',
            roomName: 'Quarto Triplo',
            checkIn: new Date('2026-11-10T00:00:00.000Z'),
            checkOut: new Date('2026-11-13T00:00:00.000Z'),
            adults: 2,
            children: 1,
            amount: 2928.18,
            guestName: 'Maria da Silva',
            guestPhone: '19999002288',
            ipAddress: '203.0.113.10',
        });

        expect(context.payerPhone).toEqual({ area_code: '19', number: '999002288' });
        expect(context.additionalInfo).toMatchObject({
            ip_address: '203.0.113.10',
            payer: { first_name: 'Maria', last_name: 'da Silva' },
            items: [{
                id: 'room-1',
                title: 'Hospedagem - Quarto Triplo',
                quantity: 1,
                unit_price: 2928.18,
            }],
        });
        expect(context.additionalInfo.items[0]).not.toHaveProperty('currency_id');
        expect(context.additionalInfo.items[0].description).toContain('3 diária(s)');
    });

    it('returns actionable rejection guidance', () => {
        expect(getPaymentRejectionMessage('cc_rejected_high_risk')).toContain('análise de segurança');
        expect(getPaymentRejectionMessage('cc_rejected_invalid_installments')).toContain('menos parcelas');
        expect(getPaymentRejectionMessage('cc_rejected_insufficient_amount')).toContain('limite disponível');
        expect(getPaymentRejectionMessage('cc_rejected_bad_filled_card_number')).toContain('número do cartão');
        expect(getPaymentRejectionMessage('cc_rejected_bad_filled_date')).toContain('data de validade');
        expect(getPaymentRejectionMessage('cc_rejected_bad_filled_security_code')).toContain('código de segurança');
        expect(getPaymentRejectionMessage('cc_rejected_duplicated_payment')).toContain('mesmo valor');
        expect(getPaymentRejectionMessage('cc_rejected_time_out')).toContain('não respondeu');
        expect(getPaymentRejectionMessage('rejected_by_bank')).toContain('banco emissor');
        expect(getPaymentRejectionMessage('rejected_by_regulations')).toContain('regulatórias');
        expect(getPaymentRejectionMessage('cc_rejected_other_reason')).toContain('motivo exato');
    });

    it('keeps only rejected payments eligible for another attempt', () => {
        expect(isRetryablePaymentRejection('rejected')).toBe(true);
        expect(isRetryablePaymentRejection('cancelled')).toBe(false);
        expect(isRetryablePaymentRejection('refunded')).toBe(false);
        expect(isRetryablePaymentRejection('charged_back')).toBe(false);
    });

    it('validates amount and currency before accepting an approved payment', () => {
        expect(validateApprovedPaymentAmount({
            status: 'approved', transactionAmount: 699, expectedAmount: 699, currencyId: 'BRL',
        })).toEqual({ ok: true });
        expect(validateApprovedPaymentAmount({
            status: 'approved', transactionAmount: 6.99, expectedAmount: 699, currencyId: 'BRL',
        })).toEqual({ ok: false, reason: 'amount_mismatch' });
        expect(validateApprovedPaymentAmount({
            status: 'approved', transactionAmount: 699, expectedAmount: 699, currencyId: 'USD',
        })).toEqual({ ok: false, reason: 'currency_mismatch' });
        expect(validateApprovedPaymentAmount({
            status: 'rejected', transactionAmount: null, expectedAmount: 699, currencyId: null,
        })).toEqual({ ok: true });
    });

    it('detects a rejected payment while its booking remains pending', () => {
        expect(getPolledBookingPaymentStatus({
            bookingStatus: 'PENDING',
            paymentStatus: 'REJECTED',
        })).toBe('REJECTED');
        expect(getPolledBookingPaymentStatus({
            bookingStatus: 'PENDING',
            paymentStatus: 'PENDING',
        })).toBe('PENDING');
    });

    it('maps Checkout Pro webhook statuses without cancelling a retryable rejection', () => {
        expect(mapMercadoPagoPaymentStatus('approved')).toEqual({
            bookingStatus: 'CONFIRMED',
            paymentStatus: 'APPROVED',
        });
        expect(mapMercadoPagoPaymentStatus('rejected')).toEqual({
            bookingStatus: 'PENDING',
            paymentStatus: 'REJECTED',
        });
        expect(mapMercadoPagoPaymentStatus('refunded')).toEqual({
            bookingStatus: 'CANCELLED',
            paymentStatus: 'REFUNDED',
        });
        expect(mapMercadoPagoPaymentStatus('charged_back')).toEqual({
            bookingStatus: 'CANCELLED',
            paymentStatus: 'REFUNDED',
        });
        expect(mapMercadoPagoPaymentStatus('cancelled')).toEqual({
            bookingStatus: 'CANCELLED',
            paymentStatus: 'REJECTED',
        });
        expect(mapMercadoPagoPaymentStatus('pending')).toEqual({
            bookingStatus: 'PENDING',
            paymentStatus: 'PENDING',
        });
    });
});
