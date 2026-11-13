/**
 * Endereço de cobrança do pagador (enviado ao Asaas para o checkout abrir preenchido).
 * Fica só no navegador e na chamada de checkout; não é gravado no banco.
 */
export type BillingAddress = {
    /** 8 dígitos, sem hífen. */
    postalCode: string;
    /** Rua / logradouro. */
    address: string;
    /** Número do imóvel (aceita "S/N", "12A"). */
    addressNumber: string;
    /** Bairro (o Asaas chama de province). */
    province: string;
    complement?: string;
};

function clean(value: unknown, max: number): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function onlyDigits(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
}

export function formatPostalCode(value: string): string {
    const digits = onlyDigits(value).slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/** Valida e normaliza. Devolve null se faltar qualquer campo obrigatório (CEP, rua, número, bairro). */
export function parseBillingAddress(input: unknown): BillingAddress | null {
    if (!input || typeof input !== 'object') return null;
    const raw = input as Record<string, unknown>;

    const postalCode = onlyDigits(raw.postalCode);
    const address = clean(raw.address, 255);
    const addressNumber = clean(raw.addressNumber, 20);
    const province = clean(raw.province, 100);
    const complement = clean(raw.complement, 255);

    if (postalCode.length !== 8) return null;
    if (address.length < 2 || !addressNumber || province.length < 2) return null;

    return { postalCode, address, addressNumber, province, ...(complement ? { complement } : {}) };
}

/** Campos do endereço a gravar no cadastro do hóspede (vazio se o endereço não veio completo). */
export function guestAddressData(input: unknown): Record<string, string | null> {
    const billing = parseBillingAddress(input);
    if (!billing) return {};
    const raw = (input ?? {}) as Record<string, unknown>;
    return {
        postalCode: billing.postalCode,
        address: billing.address,
        addressNumber: billing.addressNumber,
        complement: billing.complement ?? null,
        province: billing.province,
        city: clean(raw.city, 100) || null,
        state: clean(raw.state, 2).toUpperCase() || null,
    };
}

/** Linha única de endereço para exibir (admin): "Rua X, 120 (Apto 3) · Bairro · Cidade/UF · CEP 00000-000". */
export function formatGuestAddressLine(guest: {
    address?: string | null;
    addressNumber?: string | null;
    complement?: string | null;
    province?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
}): string | null {
    const street = clean(guest.address, 255);
    const number = clean(guest.addressNumber, 20);
    const complement = clean(guest.complement, 255);
    const province = clean(guest.province, 100);
    const city = clean(guest.city, 100);
    const state = clean(guest.state, 2).toUpperCase();
    const postalCode = onlyDigits(guest.postalCode);

    if (!street && postalCode.length !== 8) return null;

    const streetPart = [street, number].filter(Boolean).join(', ') + (complement ? ` (${complement})` : '');
    const cityPart = [city, state].filter(Boolean).join('/');
    return [streetPart, province, cityPart, postalCode.length === 8 ? `CEP ${formatPostalCode(postalCode)}` : '']
        .filter(Boolean)
        .join(' · ');
}

