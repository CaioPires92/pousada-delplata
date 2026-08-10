import { isQuoteExpired } from "@/lib/crm/quoteFlow";

export type QuoteLoadResult = {
  responseOk: boolean;
  body: {
    quote?: {
      ok?: boolean;
      expiresAt?: string;
      quoteId?: string;
      calculatedAt?: string;
    };
    [key: string]: unknown;
  } | null;
};

export async function loadFreshQuote(
  load: () => Promise<QuoteLoadResult>,
  now: () => Date = () => new Date(),
) {
  const initial = await load();
  const initialQuote = initial.body?.quote;
  if (!initial.responseOk || !initialQuote?.ok || !isQuoteExpired(initialQuote.expiresAt, now())) {
    return { result: initial, revalidated: false, expiredQuote: null };
  }

  const refreshed = await load();
  return {
    result: refreshed,
    revalidated: true,
    expiredQuote: {
      quoteId: initialQuote.quoteId ?? null,
      calculatedAt: initialQuote.calculatedAt ?? null,
      expiresAt: initialQuote.expiresAt ?? null,
    },
  };
}
