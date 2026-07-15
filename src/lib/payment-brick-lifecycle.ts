export type PaymentBrickController = {
    unmount: () => Promise<void> | void;
};

type MutableRef<T> = { current: T };

export async function safelyUnmountPaymentBrick(controller: PaymentBrickController | null) {
    if (!controller) return;

    try {
        await controller.unmount();
    } catch {
        // A recriacao do Brick nao deve ser bloqueada por uma falha de desmontagem.
    }
}

export async function mountLatestPaymentBrick({
    requestId,
    latestRequestRef,
    activeBrickRef,
    create,
}: {
    requestId: number;
    latestRequestRef: MutableRef<number>;
    activeBrickRef: MutableRef<PaymentBrickController | null>;
    create: () => Promise<PaymentBrickController>;
}) {
    const previousBrick = activeBrickRef.current;
    activeBrickRef.current = null;
    await safelyUnmountPaymentBrick(previousBrick);

    if (latestRequestRef.current !== requestId) return null;

    const nextBrick = await create();
    if (latestRequestRef.current !== requestId) {
        await safelyUnmountPaymentBrick(nextBrick);
        return null;
    }

    activeBrickRef.current = nextBrick;
    return nextBrick;
}
