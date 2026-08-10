import { describe, expect, it, vi } from "vitest";

import { loadFreshQuote } from "./freshQuote";

describe("loadFreshQuote", () => {
  const now = () => new Date("2026-08-10T18:00:00.000Z");

  it("keeps a quote that is still valid", async () => {
    const load = vi.fn().mockResolvedValue({
      responseOk: true,
      body: { quote: { ok: true, quoteId: "quote-1", expiresAt: "2026-08-10T18:01:00.000Z" } },
    });

    await expect(loadFreshQuote(load, now)).resolves.toMatchObject({ revalidated: false });
    expect(load).toHaveBeenCalledOnce();
  });

  it("consults the Map service again when the first quote expired", async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({
        responseOk: true,
        body: {
          quote: {
            ok: true,
            quoteId: "quote-expired",
            calculatedAt: "2026-08-10T17:40:00.000Z",
            expiresAt: "2026-08-10T17:55:00.000Z",
          },
        },
      })
      .mockResolvedValueOnce({
        responseOk: true,
        body: { quote: { ok: true, quoteId: "quote-fresh", expiresAt: "2026-08-10T18:15:00.000Z" } },
      });

    const result = await loadFreshQuote(load, now);

    expect(load).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      revalidated: true,
      expiredQuote: { quoteId: "quote-expired" },
      result: { body: { quote: { quoteId: "quote-fresh" } } },
    });
  });

  it("does not retry a business validation error", async () => {
    const load = vi.fn().mockResolvedValue({
      responseOk: false,
      body: { error: "min_stay_required" },
    });

    await expect(loadFreshQuote(load, now)).resolves.toMatchObject({ revalidated: false });
    expect(load).toHaveBeenCalledOnce();
  });
});
