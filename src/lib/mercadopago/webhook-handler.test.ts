import crypto from 'crypto';
import { describe, expect, it } from 'vitest';

import {
    getMercadoPagoWebhookSignatureDataId,
    validateMercadoPagoWebhookSignature,
} from './webhook-handler';

describe('Mercado Pago webhook signature', () => {
    const paymentId = '123456789';
    const requestId = 'request-abc';
    const webhookSecret = 'webhook-secret';
    const ts = '1700000000';

    function signatureFor(id = paymentId) {
        const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
        const hash = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
        return `ts=${ts},v1=${hash}`;
    }

    it('accepts the documented HMAC manifest', () => {
        expect(validateMercadoPagoWebhookSignature({
            signature: signatureFor(), requestId, webhookSecret, paymentId,
        })).toEqual({ ok: true });
    });

    it('extracts data.id from the webhook query string', () => {
        expect(getMercadoPagoWebhookSignatureDataId(
            'https://example.com/api/webhooks/mercadopago?data.id=ABC123&type=payment'
        )).toBe('abc123');
        expect(getMercadoPagoWebhookSignatureDataId(
            'https://example.com/api/webhooks/mercadopago'
        )).toBe('');
    });

    it('rejects a signature for another payment', () => {
        expect(validateMercadoPagoWebhookSignature({
            signature: signatureFor('other-payment'), requestId, webhookSecret, paymentId,
        })).toMatchObject({ ok: false, reason: 'Invalid signature' });
    });

    it('rejects missing and malformed signature headers', () => {
        expect(validateMercadoPagoWebhookSignature({
            signature: null, requestId, webhookSecret, paymentId,
        })).toMatchObject({ ok: false, reason: 'Missing signature headers' });
        expect(validateMercadoPagoWebhookSignature({
            signature: 'invalid', requestId, webhookSecret, paymentId,
        })).toMatchObject({ ok: false, reason: 'Invalid signature format' });
    });
});
