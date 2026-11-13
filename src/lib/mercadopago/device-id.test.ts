import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    buildMercadoPagoDeviceRequestOptions,
    buildSafePaymentSecurityTelemetry,
    normalizeMercadoPagoDeviceId,
    readMercadoPagoDeviceId,
    startMercadoPagoDeviceIdObservation,
    waitForMercadoPagoDeviceId,
} from './device-id';

describe('Mercado Pago Device ID', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        delete (window as typeof window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID;
        document.querySelectorAll('script[src*="mercadopago.com/v2/security.js"]').forEach((script) => script.remove());
    });

    it('reads and normalizes the browser Device ID', () => {
        (window as typeof window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID = '  device-session-123  ';

        expect(readMercadoPagoDeviceId()).toBe('device-session-123');
        expect(normalizeMercadoPagoDeviceId('   ')).toBeUndefined();
        expect(normalizeMercadoPagoDeviceId(123)).toBeUndefined();
        expect(normalizeMercadoPagoDeviceId('x'.repeat(300))).toHaveLength(256);
    });

    it('forwards only a non-empty Device ID to the SDK', () => {
        expect(buildMercadoPagoDeviceRequestOptions(' device-session-123 ')).toEqual({
            meliSessionId: 'device-session-123',
        });
        expect(buildMercadoPagoDeviceRequestOptions(undefined)).toEqual({});
    });

    it('reports only safe presence metadata', () => {
        const telemetry = buildSafePaymentSecurityTelemetry({
            deviceId: 'secret-device-id',
            token: 'secret-card-token',
            identification: { type: 'CPF', number: '12345678909' },
            paymentMethodId: 'master',
            paymentTypeId: 'credit_card',
            installments: 3,
        });

        expect(telemetry).toEqual({
            hasDeviceId: true,
            deviceIdLength: 16,
            hasCardToken: true,
            hasIdentification: true,
            paymentMethodId: 'master',
            paymentTypeId: 'credit_card',
            installments: 3,
        });
        expect(JSON.stringify(telemetry)).not.toContain('secret');
        expect(JSON.stringify(telemetry)).not.toContain('12345678909');
    });

    it('reuses a Device ID that was available before the payment click', async () => {
        (window as typeof window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID = 'device-ready-early';

        const stopObservation = startMercadoPagoDeviceIdObservation();

        await expect(waitForMercadoPagoDeviceId(10_000)).resolves.toBe('device-ready-early');
        expect(vi.getTimerCount()).toBe(0);
        stopObservation();
    });

    it('shares one polling cycle and resolves waiters when the Device ID arrives later', async () => {
        const stopFirstObservation = startMercadoPagoDeviceIdObservation();
        const stopSecondObservation = startMercadoPagoDeviceIdObservation();
        const firstWait = waitForMercadoPagoDeviceId(10_000);
        const secondWait = waitForMercadoPagoDeviceId(10_000);

        expect(vi.getTimerCount()).toBe(4);
        (window as typeof window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID = 'device-ready-later';
        await vi.advanceTimersByTimeAsync(50);

        await expect(firstWait).resolves.toBe('device-ready-later');
        await expect(secondWait).resolves.toBe('device-ready-later');
        stopFirstObservation();
        stopSecondObservation();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('times out one payment wait without inventing an identifier or stopping the shared observation', async () => {
        const stopObservation = startMercadoPagoDeviceIdObservation();
        const wait = waitForMercadoPagoDeviceId(10_000);

        await vi.advanceTimersByTimeAsync(10_000);

        await expect(wait).resolves.toBeUndefined();
        expect(readMercadoPagoDeviceId()).toBeUndefined();
        expect(vi.getTimerCount()).toBe(2);
        stopObservation();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('settles pending waiters when the security script fails', async () => {
        const stopObservation = startMercadoPagoDeviceIdObservation();
        const wait = waitForMercadoPagoDeviceId(10_000);
        const script = document.createElement('script');
        script.src = 'https://www.mercadopago.com/v2/security.js';
        document.body.appendChild(script);

        script.dispatchEvent(new Event('error'));

        await expect(wait).resolves.toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
        stopObservation();
    });

    it('cancels pending polling and waiters when the reservation page unmounts', async () => {
        const stopObservation = startMercadoPagoDeviceIdObservation();
        const wait = waitForMercadoPagoDeviceId(10_000);

        stopObservation();

        await expect(wait).resolves.toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('expires a pending observation without polling indefinitely', async () => {
        const stopObservation = startMercadoPagoDeviceIdObservation({ expirationMs: 500 });
        const wait = waitForMercadoPagoDeviceId(10_000);

        await vi.advanceTimersByTimeAsync(500);

        await expect(wait).resolves.toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
        stopObservation();
    });

    it('starts a fresh observation after expiration and keeps only one polling cycle', async () => {
        const stopObservation = startMercadoPagoDeviceIdObservation({ expirationMs: 500 });
        const expiredWait = waitForMercadoPagoDeviceId(10_000);

        await vi.advanceTimersByTimeAsync(500);
        await expect(expiredWait).resolves.toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);

        const recoveredWait = waitForMercadoPagoDeviceId(10_000);
        expect(vi.getTimerCount()).toBe(3);
        (window as typeof window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID = 'device-after-expiration';
        await vi.advanceTimersByTimeAsync(50);

        await expect(recoveredWait).resolves.toBe('device-after-expiration');
        stopObservation();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps a restarted observation alive until the last page subscriber stops', async () => {
        const stopFirstObservation = startMercadoPagoDeviceIdObservation({ expirationMs: 500 });
        const stopSecondObservation = startMercadoPagoDeviceIdObservation();
        const expiredWait = waitForMercadoPagoDeviceId(10_000);

        await vi.advanceTimersByTimeAsync(500);
        await expect(expiredWait).resolves.toBeUndefined();

        const recoveredWait = waitForMercadoPagoDeviceId(10_000);
        expect(vi.getTimerCount()).toBe(3);
        stopFirstObservation();
        expect(vi.getTimerCount()).toBe(3);

        (window as typeof window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID = 'device-after-stale-cleanup';
        await vi.advanceTimersByTimeAsync(50);

        await expect(recoveredWait).resolves.toBe('device-after-stale-cleanup');
        stopSecondObservation();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('starts a fresh observation after a security script failure', async () => {
        const stopObservation = startMercadoPagoDeviceIdObservation();
        const failedWait = waitForMercadoPagoDeviceId(10_000);
        const script = document.createElement('script');
        script.src = 'https://www.mercadopago.com/v2/security.js';
        document.body.appendChild(script);

        script.dispatchEvent(new Event('error'));
        await expect(failedWait).resolves.toBeUndefined();

        const recoveredWait = waitForMercadoPagoDeviceId(10_000);
        expect(vi.getTimerCount()).toBe(3);
        (window as typeof window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID = 'device-after-failure';
        await vi.advanceTimersByTimeAsync(50);

        await expect(recoveredWait).resolves.toBe('device-after-failure');
        stopObservation();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('starts a fresh observation after cancellation and cancels it on the next unmount', async () => {
        const stopFirstObservation = startMercadoPagoDeviceIdObservation();
        const cancelledWait = waitForMercadoPagoDeviceId(10_000);

        stopFirstObservation();
        await expect(cancelledWait).resolves.toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);

        const stopRecoveredObservation = startMercadoPagoDeviceIdObservation();
        const recoveredWait = waitForMercadoPagoDeviceId(10_000);
        expect(vi.getTimerCount()).toBe(3);

        stopRecoveredObservation();
        await expect(recoveredWait).resolves.toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('recovers on a later payment attempt without reloading the page', async () => {
        const stopObservation = startMercadoPagoDeviceIdObservation();
        const firstWait = waitForMercadoPagoDeviceId(10_000);

        await vi.advanceTimersByTimeAsync(10_000);
        await expect(firstWait).resolves.toBeUndefined();

        const secondWait = waitForMercadoPagoDeviceId(10_000);
        (window as typeof window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID = 'device-on-second-attempt';
        await vi.advanceTimersByTimeAsync(50);

        await expect(secondWait).resolves.toBe('device-on-second-attempt');
        stopObservation();
        expect(vi.getTimerCount()).toBe(0);
    });
});
