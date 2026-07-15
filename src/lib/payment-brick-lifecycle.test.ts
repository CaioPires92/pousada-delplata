import { describe, expect, it, vi } from 'vitest';
import { mountLatestPaymentBrick, type PaymentBrickController } from './payment-brick-lifecycle';

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((next) => {
        resolve = next;
    });
    return { promise, resolve };
};

describe('payment Brick lifecycle', () => {
    it('desmonta o formulario antigo quando ele termina depois do formulario mais recente', async () => {
        const latestRequestRef = { current: 1 };
        const activeBrickRef = { current: null as PaymentBrickController | null };
        const oldCreation = deferred<PaymentBrickController>();
        const newCreation = deferred<PaymentBrickController>();
        const oldBrick = { unmount: vi.fn().mockResolvedValue(undefined) };
        const newBrick = { unmount: vi.fn().mockResolvedValue(undefined) };

        const oldMount = mountLatestPaymentBrick({ requestId: 1, latestRequestRef, activeBrickRef, create: () => oldCreation.promise });
        await Promise.resolve();

        latestRequestRef.current = 2;
        const newMount = mountLatestPaymentBrick({ requestId: 2, latestRequestRef, activeBrickRef, create: () => newCreation.promise });

        newCreation.resolve(newBrick);
        await expect(newMount).resolves.toBe(newBrick);
        expect(activeBrickRef.current).toBe(newBrick);

        oldCreation.resolve(oldBrick);
        await expect(oldMount).resolves.toBeNull();
        expect(oldBrick.unmount).toHaveBeenCalledOnce();
        expect(newBrick.unmount).not.toHaveBeenCalled();
        expect(activeBrickRef.current).toBe(newBrick);
    });

    it('nao cria um formulario se a solicitacao ficar obsoleta durante a desmontagem', async () => {
        const previousUnmount = deferred<void>();
        const previousBrick = { unmount: vi.fn(() => previousUnmount.promise) };
        const latestRequestRef = { current: 1 };
        const activeBrickRef = { current: previousBrick as PaymentBrickController | null };
        const create = vi.fn();

        const mount = mountLatestPaymentBrick({ requestId: 1, latestRequestRef, activeBrickRef, create });

        latestRequestRef.current = 2;
        previousUnmount.resolve();

        await expect(mount).resolves.toBeNull();
        expect(create).not.toHaveBeenCalled();
    });
});
