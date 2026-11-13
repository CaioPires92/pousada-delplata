import type { BillingAddress } from '@/lib/billing-address';
import { opsLog } from '@/lib/ops-log';

const ASAAS_PRODUCTION_URL = 'https://api.asaas.com/v3';
const ASAAS_SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';

/**
 * Máximo de parcelas no cartão oferecido no checkout (`installment.maxInstallmentCount`).
 * Vale só para checkouts criados depois da mudança; os que já existem mantêm o limite antigo.
 */
export const ASAAS_MAX_INSTALLMENTS = 3;

export function getAsaasBaseUrl() {
    return String(process.env.ASAAS_ENVIRONMENT || '').trim().toLowerCase() === 'production'
        ? ASAAS_PRODUCTION_URL
        : ASAAS_SANDBOX_URL;
}

export function getAsaasApiKey() {
    return String(process.env.ASAAS_API_KEY || '').trim();
}

export function getAsaasCheckoutUrl(checkoutId: string) {
    const host = String(process.env.ASAAS_ENVIRONMENT || '').trim().toLowerCase() === 'production'
        ? 'https://asaas.com'
        : 'https://sandbox.asaas.com';
    return `${host}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
}

export async function asaasRequest(path: string, init: RequestInit = {}) {
    const apiKey = getAsaasApiKey();
    if (!apiKey) throw new Error('ASAAS_API_KEY_NOT_CONFIGURED');

    return fetch(`${getAsaasBaseUrl()}${path}`, {
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'PousadaDelplata/1.0',
            access_token: apiKey,
            ...init.headers,
        },
    });
}

export function getAsaasErrorMessage(result: any) {
    if (Array.isArray(result?.errors)) {
        return result.errors.map((error: any) => String(error?.description || error?.code || '')).filter(Boolean).join(' ');
    }
    return String(result?.message || result?.error || '').trim();
}

/**
 * Dados do pagador para o checkout (`customerData`).
 *
 * Em produção o Asaas rejeita (400) qualquer `customerData` sem address, addressNumber,
 * postalCode e province ("O campo address deve ser informado"), embora a documentação os
 * marque como opcionais (o sandbox aceita). Por isso só enviamos `customerData` quando há
 * endereço completo (BillingAddress); sem endereço, o checkout é criado sem dados do cliente
 * e o pagador preenche tudo na tela do Asaas. `customer` e `customerData` não vão juntos.
 * `city` não é enviado: o checkout pede um código numérico sem consulta documentada.
 */
export function buildAsaasCustomerData(
    guest: { name: string; email: string; phone: string; cpfCnpj?: string | null },
    billing: BillingAddress,
) {
    const cpfCnpj = String(guest.cpfCnpj || '').replace(/\D/g, '');
    const phone = String(guest.phone || '').replace(/\D/g, '');
    return {
        name: guest.name.trim(),
        email: guest.email.trim().toLowerCase(),
        ...(cpfCnpj ? { cpfCnpj } : {}),
        ...(phone ? { phone } : {}),
        address: billing.address,
        // O schema do Asaas tipa o número como inteiro; números como "S/N" ou "12A" seguem como texto.
        addressNumber: /^\d{1,9}$/.test(billing.addressNumber) ? Number(billing.addressNumber) : billing.addressNumber,
        postalCode: billing.postalCode,
        province: billing.province,
        ...(billing.complement ? { complement: billing.complement } : {}),
    };
}

/**
 * Cria o checkout no Asaas. Com `customerData` (endereço completo) o checkout abre preenchido; se o Asaas
 * recusar esses dados (4xx), refaz sem eles para nunca travar a venda — o pagador preenche na tela do Asaas.
 */
export async function createAsaasCheckout(
    payload: Record<string, unknown>,
    customerData: ReturnType<typeof buildAsaasCustomerData> | null,
    context: { bookingId: string },
) {
    const send = (withCustomerData: boolean) =>
        asaasRequest('/checkouts', {
            method: 'POST',
            body: JSON.stringify({ ...payload, ...(withCustomerData && customerData ? { customerData } : {}) }),
        });

    let response = await send(Boolean(customerData));
    let result: any = await response.json().catch(() => ({}));
    if (customerData && (!response.ok || !result?.id) && response.status >= 400 && response.status < 500) {
        opsLog('warn', 'ASAAS_CHECKOUT_CUSTOMERDATA_REJECTED', {
            bookingId: context.bookingId, status: response.status, message: getAsaasErrorMessage(result),
        });
        response = await send(false);
        result = await response.json().catch(() => ({}));
    }
    return { response, result };
}

