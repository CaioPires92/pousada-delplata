import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyIntent } from "./aiIntentClassifier";

describe("classifyIntent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    delete process.env.CRM_AI_SHADOW_MODE;
    delete process.env.OPENAI_API_KEY;
    vi.unstubAllGlobals();
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

  it("accepts only a schema-valid shadow decision", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.CRM_AI_SHADOW_MODE = "true";
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: [{ content: [{ text: JSON.stringify({
          schemaVersion: 1,
          intent: "parking",
          confidence: 0.92,
          suggestedAction: "answer_approved_faq",
          reasonCode: "recognized_intent",
          entities: {},
        }) }] }],
      }),
    } as Response);

    const result = await classifyIntent("Tem estacionamento?");

    expect(result.source).toBe("ai");
    expect(result.decision?.schemaVersion).toBe(1);
  });

  it("falls back safely when shadow output violates the schema", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.CRM_AI_SHADOW_MODE = "true";
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ output: [{ content: [{ text: '{"intent":"discount","confidence":2}' }] }] }),
    } as Response);

    const result = await classifyIntent("Tem estacionamento?");

    expect(result.source).toBe("heuristic");
    expect(result.intent).toBe("parking");
  });
});
