import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyIntent } from "./aiIntentClassifier";

describe("classifyIntent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    delete process.env.CRM_AI_SHADOW_MODE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.CRM_AI_TIMEOUT_MS;
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
        usage: { input_tokens: 42, output_tokens: 18 },
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
    expect(result).toMatchObject({
      result: "classified",
      inputTokens: 42,
      outputTokens: 18,
      latencyMs: expect.any(Number),
    });
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
    expect(result.result).toBe("fallback_invalid_response");
  });

  it("uses a bounded timeout and falls back when the AI request fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.CRM_AI_SHADOW_MODE = "true";
    process.env.CRM_AI_TIMEOUT_MS = "900";
    vi.mocked(global.fetch).mockRejectedValueOnce(new DOMException("timeout", "AbortError"));

    const result = await classifyIntent("Tem estacionamento?");

    expect(result).toMatchObject({ source: "heuristic", intent: "parking" });
    expect(result.result).toBe("fallback_timeout");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
