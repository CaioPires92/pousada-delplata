type ConversationAutomationLockGlobal = typeof globalThis & {
  __delplataConversationAutomationTails?: Map<string, Promise<void>>;
};

const lockGlobal = globalThis as ConversationAutomationLockGlobal;

export async function withConversationAutomationLock<T>(
  conversationId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const tails = lockGlobal.__delplataConversationAutomationTails ?? new Map<string, Promise<void>>();
  lockGlobal.__delplataConversationAutomationTails = tails;

  const previous = tails.get(conversationId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  tails.set(conversationId, tail);
  await previous;

  try {
    return await operation();
  } finally {
    release();
    if (tails.get(conversationId) === tail) tails.delete(conversationId);
  }
}
