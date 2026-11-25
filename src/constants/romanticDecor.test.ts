import { describe, expect, it } from "vitest";

import { buildRomanticDecorWhatsAppUrl, ROMANTIC_DECOR_PHOTOS } from "./romanticDecor";

describe("decoração romântica", () => {
  it("monta o link do WhatsApp com o valor e o quarto", () => {
    const url = new URL(buildRomanticDecorWhatsAppUrl("Apartamento Superior"));
    expect(url.hostname).toBe("wa.me");
    const text = url.searchParams.get("text") ?? "";
    expect(text).toContain("R$ 80");
    expect(text).toContain("Apartamento Superior");
  });

  it("funciona sem quarto", () => {
    const text = new URL(buildRomanticDecorWhatsAppUrl()).searchParams.get("text") ?? "";
    expect(text).toContain("decoração romântica");
    expect(text).not.toContain("null");
  });

  it("todas as fotos existem no repositório", async () => {
    const { existsSync } = await import("node:fs");
    for (const photo of ROMANTIC_DECOR_PHOTOS) expect(existsSync(`public${photo.src}`)).toBe(true);
  });
});
