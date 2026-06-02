import { describe, expect, it } from "vitest";

import { classifyIntent } from "./aiIntentClassifier";

describe("classifyIntent", () => {
  it("falls back to heuristic classifier when API key is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await classifyIntent("quero fechar a reserva e pagar no pix");

    expect(result.source).toBe("heuristic");
    expect(result.intent).toBe("reservation");
  });
});
