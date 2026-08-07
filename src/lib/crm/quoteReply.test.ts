import { describe, expect, it } from "vitest";

import { buildQuoteReplyText } from "./quoteReply";

describe("buildQuoteReplyText", () => {
  it("formats a concise quote without exposing inventory or adding a sales prompt", () => {
    const text = buildQuoteReplyText({
      checkin: "2026-09-12",
      checkout: "2026-09-13",
      nights: 1,
      options: [
        { roomTypeName: "Apartamento Anexo", totalPrice: 399 },
        { roomTypeName: "Chalé", totalPrice: 499 },
      ],
    });

    expect(text).toBe([
      "Para 12/09 a 13/09 (1 diária), temos:",
      "• Apartamento Anexo: R$ 399,00",
      "• Chalé: R$ 499,00",
    ].join("\n"));
    expect(text).not.toContain("unidade");
    expect(text).not.toContain("condições de pagamento");
  });
});
