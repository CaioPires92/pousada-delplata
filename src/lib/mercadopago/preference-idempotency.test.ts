import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildHostedCheckoutIdempotencyKey } from './preference-idempotency';

const BOOKING_ID = '3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f';
const payer = {
    name: 'João',
    surname: 'Pereira',
    email: 'joao@example.com',
    identification: { type: 'CPF', number: '52998224725' },
};
const confirmationUrl = `https://www.pousadadelplata.com.br/reservar/confirmacao/${BOOKING_ID}`;
function preferencePayload(overrides: Record<string, unknown> = {}, accessToken = 'token-a') {
    return {
        items: [{ id: 'room-1', title: 'Pousada Delplata - Quarto Triplo', unit_price: 1898, category_id: 'travels' }],
        payer,
        back_urls: {
            success: `${confirmationUrl}#access=${accessToken}`,
            failure: `${confirmationUrl}#access=${accessToken}`,
            pending: `${confirmationUrl}#access=${accessToken}`,
        },
        external_reference: BOOKING_ID,
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }], installments: 12 },
        ...overrides,
    };
}
const baseInput = {
    bookingId: BOOKING_ID,
    paymentMode: 'PARTIAL',
    amountDueNow: 1898,
    testMode: false,
    payload: preferencePayload(),
};

describe('buildHostedCheckoutIdempotencyKey', () => {
    const originalSecret = process.env.BOOKING_ACCESS_SECRET;
    const originalAdminSecret = process.env.ADMIN_JWT_SECRET;

    beforeEach(() => {
        process.env.BOOKING_ACCESS_SECRET = 'secret-a';
        delete process.env.ADMIN_JWT_SECRET;
    });

    afterEach(() => {
        if (originalSecret === undefined) delete process.env.BOOKING_ACCESS_SECRET;
        else process.env.BOOKING_ACCESS_SECRET = originalSecret;
        if (originalAdminSecret === undefined) delete process.env.ADMIN_JWT_SECRET;
        else process.env.ADMIN_JWT_SECRET = originalAdminSecret;
    });

    it('é determinística e não depende da ordem das propriedades do pagador', () => {
        const first = buildHostedCheckoutIdempotencyKey(baseInput);
        const reordered = buildHostedCheckoutIdempotencyKey({
            ...baseInput,
            payload: preferencePayload({
                payer: { identification: { number: '52998224725', type: 'CPF' }, email: 'joao@example.com', surname: 'Pereira', name: 'João' },
            }),
        });

        expect(first).toEqual(reordered);
        expect(first.payerAware).toBe(true);
        expect(first.key).toMatch(new RegExp(`^hosted-checkout-${BOOKING_ID}-PARTIAL-prod-v3-[0-9a-f]{32}$`));
        expect(first.key.length).toBeLessThanOrEqual(128);
    });

    it('ignora o token de acesso volátil no fragmento das URLs de retorno', () => {
        const first = buildHostedCheckoutIdempotencyKey({ ...baseInput, payload: preferencePayload({}, 'token-a') });
        const renewedToken = buildHostedCheckoutIdempotencyKey({ ...baseInput, payload: preferencePayload({}, 'token-b') });
        expect(first.key).toBe(renewedToken.key);
    });

    it('muda com pagador, itens, URLs, meios de pagamento, valor, modalidade ou ambiente', () => {
        const keys = [
            buildHostedCheckoutIdempotencyKey(baseInput).key,
            buildHostedCheckoutIdempotencyKey({ ...baseInput, payload: preferencePayload({ payer: { ...payer, identification: { type: 'CPF', number: '11144477735' } } }) }).key,
            buildHostedCheckoutIdempotencyKey({ ...baseInput, payload: preferencePayload({ payer: { ...payer, email: undefined } }) }).key,
            buildHostedCheckoutIdempotencyKey({ ...baseInput, payload: preferencePayload({ items: [{ id: 'room-2', title: 'Pousada Delplata - Suíte', unit_price: 1898, category_id: 'travels' }] }) }).key,
            buildHostedCheckoutIdempotencyKey({ ...baseInput, payload: preferencePayload({ back_urls: { success: 'https://outro-dominio.example/ok' } }) }).key,
            buildHostedCheckoutIdempotencyKey({ ...baseInput, payload: preferencePayload({ payment_methods: { installments: 6 } }) }).key,
            buildHostedCheckoutIdempotencyKey({ ...baseInput, amountDueNow: 1898.01 }).key,
            buildHostedCheckoutIdempotencyKey({ ...baseInput, paymentMode: 'FULL', amountDueNow: 3796 }).key,
            buildHostedCheckoutIdempotencyKey({ ...baseInput, testMode: true }).key,
        ];
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('não contém dados pessoais nem um SHA-256 simples dos dados', () => {
        const { key } = buildHostedCheckoutIdempotencyKey(baseInput);
        for (const sensitive of ['52998224725', 'João', 'Joao', 'Pereira', 'joao@example.com']) {
            expect(key).not.toContain(sensitive);
        }
        const fingerprint = key.slice(-32);
        const plainHashes = [
            createHash('sha256').update('52998224725').digest('hex'),
            createHash('sha256').update(JSON.stringify(payer)).digest('hex'),
        ];
        for (const plainHash of plainHashes) expect(plainHash).not.toContain(fingerprint);
    });

    it('depende do segredo server-side (sem segredo, não é recalculável por terceiros)', () => {
        const withSecretA = buildHostedCheckoutIdempotencyKey(baseInput).key;
        process.env.BOOKING_ACCESS_SECRET = 'secret-b';
        const withSecretB = buildHostedCheckoutIdempotencyKey(baseInput).key;
        expect(withSecretA).not.toBe(withSecretB);
    });

    it('usa ADMIN_JWT_SECRET como reserva, como o token de acesso da reserva', () => {
        delete process.env.BOOKING_ACCESS_SECRET;
        process.env.ADMIN_JWT_SECRET = 'admin-secret';
        expect(buildHostedCheckoutIdempotencyKey(baseInput).payerAware).toBe(true);
    });

    it('sem nenhum segredo, devolve chave estável sem dados do pagador', () => {
        delete process.env.BOOKING_ACCESS_SECRET;
        expect(buildHostedCheckoutIdempotencyKey(baseInput)).toEqual({
            key: `hosted-checkout-${BOOKING_ID}-PARTIAL-prod-v3`,
            payerAware: false,
        });
    });
});
