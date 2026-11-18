import { isValidEmail } from '@/lib/email-validation';
import { isValidCpf, normalizeCpf } from '@/lib/cpf';
import { normalizeBrazilianPhone, splitGuestName } from '@/lib/mercadopago/payment-context';

// Responsável pelo pagamento no Checkout Pro.
// GUEST: o próprio hóspede paga (padrão). THIRD_PARTY: outra pessoa paga.
// Regra central: nome, sobrenome, e-mail, telefone e CPF enviados em `payer`
// devem pertencer à mesma pessoa. Dados do hóspede nunca completam um terceiro.
export type CheckoutPayerType = 'GUEST' | 'THIRD_PARTY';

export type CheckoutPayerRequest = {
    type: CheckoutPayerType;
    name?: string;
    email?: string;
    phone?: string;
};

export type CheckoutPayerField = 'type' | 'name' | 'email' | 'phone' | 'cpf';

export type MercadoPagoPreferencePayer = {
    name?: string;
    surname?: string;
    email?: string;
    phone?: { area_code: string; number: string };
    identification: { type: 'CPF'; number: string };
};

export type CheckoutPayerResolution =
    | { ok: true; type: CheckoutPayerType; payer: MercadoPagoPreferencePayer }
    | { ok: false; error: 'INVALID_PAYER_IDENTIFICATION' | 'INVALID_PAYER_DATA'; field: CheckoutPayerField };

const MAX_PAYER_NAME_LENGTH = 120;
const MAX_PAYER_EMAIL_LENGTH = 254;
// Letras (inclui acentos e marcas combinantes), espaço, apóstrofo, hífen e ponto. Sem dígitos ou símbolos.
const PAYER_NAME_PATTERN = /^\p{L}[\p{L}\p{M}' .-]*$/u;

// NFC junta acentos colados de PDF/macOS; apóstrofos tipográficos (iOS) viram ASCII.
function normalizeName(value: unknown) {
    return String(value ?? '')
        .normalize('NFC')
        .replace(/[‘’ʼ`´]/g, "'")
        .trim()
        .replace(/\s+/g, ' ');
}

// Telefone do terceiro: só número brasileiro. DDI estrangeiro é recusado em vez de
// ser reinterpretado como DDD (o que inventaria um telefone).
function normalizeThirdPartyPhone(value: unknown) {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;
    if (raw.startsWith('+') && !/^\+\s*55/.test(raw)) return null;
    const digits = raw.replace(/\D/g, '');
    const national = digits.length === 10 || digits.length === 11;
    const withCountryCode = digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
    if (raw.startsWith('+') ? !withCountryCode : !(national || withCountryCode)) return null;
    return normalizeBrazilianPhone(raw) ?? null;
}

// Nome do terceiro: exige nome e sobrenome reais, pois precisam corresponder ao titular do CPF.
export function isValidThirdPartyPayerName(value: unknown) {
    const name = normalizeName(value);
    if (name.length < 3 || name.length > MAX_PAYER_NAME_LENGTH) return false;
    if (!PAYER_NAME_PATTERN.test(name)) return false;
    const parts = name.split(' ').filter((part) => /\p{L}/u.test(part));
    return parts.length >= 2;
}

export function isValidOptionalPayerEmail(value: unknown) {
    const email = String(value ?? '').trim();
    if (!email) return true;
    return email.length <= MAX_PAYER_EMAIL_LENGTH && isValidEmail(email);
}

export function isValidOptionalPayerPhone(value: unknown) {
    return normalizeThirdPartyPhone(value) !== null;
}

// Lê o campo `payer` do corpo da requisição. Ausente = hóspede paga (compatível com clientes antigos).
export function parseCheckoutPayerRequest(raw: unknown): CheckoutPayerRequest | null {
    if (raw === undefined || raw === null) return { type: 'GUEST' };
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    if (record.type === 'GUEST') return { type: 'GUEST' };
    if (record.type !== 'THIRD_PARTY') return null;
    return {
        type: 'THIRD_PARTY',
        name: typeof record.name === 'string' ? record.name : '',
        email: typeof record.email === 'string' ? record.email : '',
        phone: typeof record.phone === 'string' ? record.phone : '',
    };
}

export function resolveCheckoutPayer(input: {
    payer: unknown;
    cpf: unknown;
    guest: { name: string; email: string; phone?: string | null };
}): CheckoutPayerResolution {
    const request = parseCheckoutPayerRequest(input.payer);
    if (!request) return { ok: false, error: 'INVALID_PAYER_DATA', field: 'type' };

    const cpf = normalizeCpf(input.cpf);
    if (!isValidCpf(cpf)) return { ok: false, error: 'INVALID_PAYER_IDENTIFICATION', field: 'cpf' };
    const identification = { type: 'CPF' as const, number: cpf };

    if (request.type === 'GUEST') {
        const { firstName, lastName } = splitGuestName(input.guest.name);
        const phone = normalizeBrazilianPhone(input.guest.phone);
        return {
            ok: true,
            type: 'GUEST',
            payer: {
                ...(firstName ? { name: firstName } : {}),
                ...(lastName ? { surname: lastName } : {}),
                email: input.guest.email,
                ...(phone ? { phone } : {}),
                identification,
            },
        };
    }

    if (!isValidThirdPartyPayerName(request.name)) {
        return { ok: false, error: 'INVALID_PAYER_DATA', field: 'name' };
    }
    if (!isValidOptionalPayerEmail(request.email)) {
        return { ok: false, error: 'INVALID_PAYER_DATA', field: 'email' };
    }
    if (!isValidOptionalPayerPhone(request.phone)) {
        return { ok: false, error: 'INVALID_PAYER_DATA', field: 'phone' };
    }

    const { firstName, lastName } = splitGuestName(normalizeName(request.name));
    const email = String(request.email ?? '').trim().toLowerCase();
    const phone = normalizeThirdPartyPhone(request.phone) ?? undefined;
    return {
        ok: true,
        type: 'THIRD_PARTY',
        payer: {
            ...(firstName ? { name: firstName } : {}),
            ...(lastName ? { surname: lastName } : {}),
            // Sem fallback para e-mail/telefone do hóspede: pertencem a outra pessoa.
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            identification,
        },
    };
}

// Validação do formulário (mesmas regras do servidor), sem CPF: o CPF já é validado à parte.
export function validateThirdPartyPayerForm(input: { name: string; email: string; phone: string }) {
    if (!isValidThirdPartyPayerName(input.name)) {
        return 'Informe nome e sobrenome do responsável pelo pagamento, como constam no CPF.';
    }
    if (!isValidOptionalPayerEmail(input.email)) return 'Informe um e-mail válido para o responsável pelo pagamento ou deixe o campo em branco.';
    if (!isValidOptionalPayerPhone(input.phone)) return 'Informe um telefone válido com DDD para o responsável pelo pagamento ou deixe o campo em branco.';
    return '';
}

export function buildCheckoutPayerRequest(input: {
    payerIsGuest: boolean;
    thirdParty: { name: string; email: string; phone: string };
}): CheckoutPayerRequest {
    if (input.payerIsGuest) return { type: 'GUEST' };
    const email = input.thirdParty.email.trim();
    const phone = input.thirdParty.phone.trim();
    return {
        type: 'THIRD_PARTY',
        name: normalizeName(input.thirdParty.name),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
    };
}
