import { createHmac } from 'node:crypto';

// Versão do payload da preferência do Checkout Pro. Incrementar quando o conteúdo enviado
// ao Mercado Pago mudar de forma relevante (ex.: v2 = payer coerente + category_id "travels";
// v3 = link e Pix vencem com o prazo da reserva),
// para que reservas em andamento não reaproveitem uma preferência criada com o payload antigo.
export const HOSTED_CHECKOUT_PAYLOAD_VERSION = 'v3';

const KEY_PREFIX = 'hosted-checkout';
const FINGERPRINT_DOMAIN = 'delplata:mp-preference-idempotency';
const FINGERPRINT_HEX_LENGTH = 32;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

// Reaproveita o segredo server-side já usado para assinar o acesso à reserva (sem nova variável).
function getIdempotencySecret() {
    return String(process.env.BOOKING_ACCESS_SECRET || process.env.ADMIN_JWT_SECRET || '').trim();
}

// URLs de retorno levam um token de acesso com expiração no fragmento (#access=...), que muda a
// cada requisição; o fragmento não altera o destino e fica fora da impressão digital.
function stripUrlFragment(value: string) {
    if (!/^https?:\/\//i.test(value)) return value;
    const hashIndex = value.indexOf('#');
    return hashIndex >= 0 ? value.slice(0, hashIndex) : value;
}

// JSON com chaves ordenadas: o mesmo conteúdo lógico sempre gera a mesma impressão digital.
function canonicalJson(value: unknown): string {
    if (typeof value === 'string') return JSON.stringify(stripUrlFragment(value));
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, entryValue]) => entryValue !== undefined)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
        return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

export type HostedCheckoutIdempotencyInput = {
    bookingId: string;
    paymentMode: string;
    amountDueNow: number;
    testMode: boolean;
    // Corpo da preferência exatamente como será enviado ao Mercado Pago (inclui payer e items).
    payload: unknown;
};

export type HostedCheckoutIdempotencyKey = {
    key: string;
    // false quando não há segredo: a chave deixa de distinguir mudanças de pagador.
    payerAware: boolean;
};

// Chave determinística por tentativa lógica: mesmo corpo enviado (pagador, itens, valor, URLs,
// meios de pagamento), mesma reserva, modalidade e versão => mesma chave; qualquer mudança => chave nova.
// Observação: o MP não documenta idempotência em /checkout/preferences; a deduplicação é hipótese.
// O pagador entra apenas via HMAC com segredo server-side: CPF, nome, e-mail e telefone
// nunca aparecem em texto, e um hash simples (sem segredo) não é usado.
export function buildHostedCheckoutIdempotencyKey(input: HostedCheckoutIdempotencyInput): HostedCheckoutIdempotencyKey {
    const environment = input.testMode ? 'test' : 'prod';
    const base = `${KEY_PREFIX}-${input.bookingId}-${input.paymentMode}-${environment}-${HOSTED_CHECKOUT_PAYLOAD_VERSION}`;
    const secret = getIdempotencySecret();
    if (!secret) return { key: base.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH), payerAware: false };

    const fingerprint = createHmac('sha256', secret)
        .update(`${FINGERPRINT_DOMAIN}:${HOSTED_CHECKOUT_PAYLOAD_VERSION}\n`)
        .update(canonicalJson({
            bookingId: input.bookingId,
            paymentMode: input.paymentMode,
            amountDueNowCents: Math.round(Number(input.amountDueNow) * 100),
            testMode: input.testMode,
            payload: input.payload ?? null,
        }))
        .digest('hex')
        .slice(0, FINGERPRINT_HEX_LENGTH);

    // Limite de 1 a 128 caracteres documentado pelo MP para Orders; aplicado aqui por cautela.
    // Com id UUID a chave tem ~102 caracteres; se o prefixo crescer, a impressão digital é preservada.
    const key = `${base}-${fingerprint}`;
    return {
        key: key.length <= MAX_IDEMPOTENCY_KEY_LENGTH
            ? key
            : `${base.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH - FINGERPRINT_HEX_LENGTH - 1)}-${fingerprint}`,
        payerAware: true,
    };
}
