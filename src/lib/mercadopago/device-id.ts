export const MERCADO_PAGO_SECURITY_SCRIPT_URL = 'https://www.mercadopago.com/v2/security.js';
export const MERCADO_PAGO_DEVICE_CHECKOUT_WAIT_TIMEOUT_MS = 10_000;

const MAX_DEVICE_ID_LENGTH = 256;
const DEFAULT_OBSERVATION_EXPIRATION_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 50;

type DeviceIdObservationStatus = 'pending' | 'ready' | 'failed' | 'expired' | 'cancelled';

type DeviceIdObservation = {
    status: DeviceIdObservationStatus;
    deviceId?: string;
    promise: Promise<string | undefined>;
    resolve: (deviceId: string | undefined) => void;
    pollTimer?: number;
    expirationTimer?: number;
    scriptErrorHandler: (event: Event) => void;
};

let sharedObservation: DeviceIdObservation | undefined;
let observationSubscribers = 0;

export function normalizeMercadoPagoDeviceId(value: unknown) {
    const deviceId = typeof value === 'string' ? value.trim() : '';
    return deviceId ? deviceId.slice(0, MAX_DEVICE_ID_LENGTH) : undefined;
}

export function readMercadoPagoDeviceId() {
    if (typeof window === 'undefined') return undefined;
    return normalizeMercadoPagoDeviceId((window as typeof window & {
        MP_DEVICE_SESSION_ID?: unknown;
    }).MP_DEVICE_SESSION_ID);
}

function settleObservation(
    observation: DeviceIdObservation,
    status: Exclude<DeviceIdObservationStatus, 'pending'>,
    deviceId?: string
) {
    if (observation.status !== 'pending') return;

    observation.status = status;
    observation.deviceId = deviceId;
    if (observation.pollTimer !== undefined) window.clearInterval(observation.pollTimer);
    if (observation.expirationTimer !== undefined) window.clearTimeout(observation.expirationTimer);
    window.removeEventListener('error', observation.scriptErrorHandler, true);
    observation.resolve(deviceId);
}

function createObservation(options?: { expirationMs?: number; pollIntervalMs?: number }) {
    const availableDeviceId = readMercadoPagoDeviceId();
    let resolveObservation: (deviceId: string | undefined) => void = () => {};
    const promise = new Promise<string | undefined>((resolve) => {
        resolveObservation = resolve;
    });
    const observation: DeviceIdObservation = {
        status: availableDeviceId ? 'ready' : 'pending',
        deviceId: availableDeviceId,
        promise,
        resolve: resolveObservation,
        scriptErrorHandler: () => {},
    };

    if (availableDeviceId) {
        resolveObservation(availableDeviceId);
        return observation;
    }

    const pollIntervalMs = Math.max(10, options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    const expirationMs = Math.max(pollIntervalMs, options?.expirationMs ?? DEFAULT_OBSERVATION_EXPIRATION_MS);
    observation.scriptErrorHandler = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLScriptElement)) return;
        if (target.src !== MERCADO_PAGO_SECURITY_SCRIPT_URL) return;
        settleObservation(observation, 'failed');
    };
    window.addEventListener('error', observation.scriptErrorHandler, true);
    observation.pollTimer = window.setInterval(() => {
        const deviceId = readMercadoPagoDeviceId();
        if (deviceId) settleObservation(observation, 'ready', deviceId);
    }, pollIntervalMs);
    observation.expirationTimer = window.setTimeout(() => {
        settleObservation(observation, 'expired');
    }, expirationMs);

    return observation;
}

function getOrCreateObservation(options?: { expirationMs?: number; pollIntervalMs?: number }) {
    if (!sharedObservation || ['failed', 'expired', 'cancelled'].includes(sharedObservation.status)) {
        sharedObservation = createObservation(options);
    }
    return sharedObservation;
}

export function startMercadoPagoDeviceIdObservation(options?: {
    expirationMs?: number;
    pollIntervalMs?: number;
}) {
    if (typeof window === 'undefined') return () => {};

    getOrCreateObservation(options);
    observationSubscribers += 1;
    let stopped = false;

    return () => {
        if (stopped) return;
        stopped = true;
        observationSubscribers = Math.max(0, observationSubscribers - 1);
        if (observationSubscribers > 0) return;

        const currentObservation = sharedObservation;
        if (!currentObservation) return;
        settleObservation(currentObservation, 'cancelled');
        if (sharedObservation === currentObservation) sharedObservation = undefined;
    };
}

export async function waitForMercadoPagoDeviceId(timeoutMs = 1_500) {
    const availableDeviceId = readMercadoPagoDeviceId();
    if (availableDeviceId) return availableDeviceId;

    if (typeof window === 'undefined' || timeoutMs <= 0) return undefined;
    const observation = getOrCreateObservation();
    if (observation.status === 'ready') return observation.deviceId;
    if (observation.status !== 'pending') return undefined;

    return new Promise((resolve) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
            settled = true;
            resolve(undefined);
        }, timeoutMs);
        observation.promise.then((deviceId) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            resolve(deviceId);
        });
    });
}

export function buildMercadoPagoDeviceRequestOptions(deviceId: unknown) {
    const normalizedDeviceId = normalizeMercadoPagoDeviceId(deviceId);
    return normalizedDeviceId ? { meliSessionId: normalizedDeviceId } : {};
}

export function buildSafePaymentSecurityTelemetry(input: {
    deviceId: unknown;
    token: unknown;
    identification: unknown;
    paymentMethodId: unknown;
    paymentTypeId: unknown;
    installments: unknown;
}) {
    const deviceId = normalizeMercadoPagoDeviceId(input.deviceId);
    return {
        hasDeviceId: Boolean(deviceId),
        deviceIdLength: deviceId?.length || 0,
        hasCardToken: typeof input.token === 'string' && input.token.trim().length > 0,
        hasIdentification: Boolean(input.identification && typeof input.identification === 'object'),
        paymentMethodId: String(input.paymentMethodId || '').trim() || null,
        paymentTypeId: String(input.paymentTypeId || '').trim() || null,
        installments: Number.isInteger(Number(input.installments)) ? Number(input.installments) : null,
    };
}
