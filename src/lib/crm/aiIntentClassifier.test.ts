import { afterEach, describe, expect, it } from "vitest";

import { classifyIntent } from "./aiIntentClassifier";

describe("classifyIntent", () => {
  afterEach(() => {
    delete process.env.CRM_AI_SHADOW_MODE;
    delete process.env.OPENAI_API_KEY;
  });

  it("falls back to heuristic classifier when API key is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await classifyIntent("quero fechar a reserva e pagar no pix");

    expect(result.source).toBe("heuristic");
    expect(result.intent).toBe("reservation");
  });

  it("does not call AI unless shadow mode is explicitly enabled", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.CRM_AI_SHADOW_MODE = "false";

    const result = await classifyIntent("quero fechar a reserva");

    expect(result.source).toBe("heuristic");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
