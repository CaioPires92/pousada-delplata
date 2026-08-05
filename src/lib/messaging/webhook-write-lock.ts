type WebhookWriteLockGlobal = typeof globalThis & {
  __delplataWebhookWriteTail?: Promise<void>;
};

const lockGlobal = globalThis as WebhookWriteLockGlobal;

export async function withWebhookWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = lockGlobal.__delplataWebhookWriteTail ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });

  lockGlobal.__delplataWebhookWriteTail = previous.then(() => current);
  await previous;

  try {
    return await operation();
  } finally {
    release();
  }
}
