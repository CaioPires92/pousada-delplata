import { opsLog } from '@/lib/ops-log';

type Ga4PurchaseParams = {
    transactionId: string;
    value: number;
    currency?: string;
    itemId?: string | null;
    itemName?: string | null;
    clientId?: string | null;
    userId?: string | null;
    source?: string;
};

export type Ga4PurchaseResult = {
    ok: boolean;
    status?: number;
    skipped?: string;
    error?: string;
};

function roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
}

function normalizeString(value: string | null | undefined) {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
}

export async function sendGa4PurchaseServerEvent(params: Ga4PurchaseParams): Promise<Ga4PurchaseResult> {
    const measurementId = normalizeString(process.env.GA4_MEASUREMENT_ID);
    const apiSecret = normalizeString(process.env.GA4_API_SECRET);

    if (!measurementId || !apiSecret) {
        return { ok: false, skipped: 'ga4_not_configured' };
    }

    const transactionId = normalizeString(params.transactionId);
    if (!transactionId) {
        return { ok: false, skipped: 'missing_transaction_id' };
    }

    const numericValue = Number(params.value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return { ok: false, skipped: 'invalid_value' };
    }

    const value = roundCurrency(numericValue);
    const currency = normalizeString(params.currency) || 'BRL';
    const itemId = normalizeString(params.itemId) || 'hospedagem';
    const itemName = normalizeString(params.itemName) || 'Hospedagem';
    const clientId = normalizeString(params.clientId) || `server.${transactionId}`;
    const userId = normalizeString(params.userId) || undefined;

    const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

    const payload = {
        client_id: clientId,
        user_id: userId,
        events: [
            {
                name: 'purchase',
                params: {
                    transaction_id: transactionId,
                    value,
                    currency,
                    items: [
                        {
                            item_id: itemId,
                            item_name: itemName,
                            quantity: 1,
                            price: value,
                        },
                    ],
                    source: normalizeString(params.source) || 'server',
                    engagement_time_msec: 1,
                },
            },
        ],
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            const error = `HTTP ${response.status}${body ? ` - ${body.slice(0, 500)}` : ''}`;
            opsLog('warn', 'GA4_PURCHASE_SEND_FAILED', {
                transactionId,
                measurementId,
                status: response.status,
                error,
            });
            return { ok: false, status: response.status, error };
        }

        opsLog('info', 'GA4_PURCHASE_SENT', {
            transactionId,
            measurementId,
            value,
            currency,
        });
        return { ok: true, status: response.status };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        opsLog('error', 'GA4_PURCHASE_SEND_ERROR', {
            transactionId,
            measurementId,
            error: message,
        });
        return { ok: false, error: message };
    }
}

