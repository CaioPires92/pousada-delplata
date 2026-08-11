import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyIntent } from "./aiIntentClassifier";

describe("classifyIntent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    delete process.env.CRM_AI_SHADOW_MODE;
    delete process.env.CRM_AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_LIGHT_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
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

  it("classifies in shadow mode with Gemini using its response and token contract", async () => {
    process.env.CRM_AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.GEMINI_MODEL = "gemini-3-test-model";
    process.env.CRM_AI_SHADOW_MODE = "true";
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          schemaVersion: 1,
          intent: "pet",
          confidence: 0.94,
          suggestedAction: "answer_approved_faq",
          reasonCode: "recognized_intent",
          entities: {},
        }) }] } }],
        usageMetadata: { promptTokenCount: 31, candidatesTokenCount: 14 },
      }),
    } as Response);

    const result = await classifyIntent("Aceita cachorro pequeno?");

    expect(result).toMatchObject({
      source: "ai",
      intent: "pet",
      model: "gemini-3-test-model",
      inputTokens: 31,
      outputTokens: 14,
      result: "classified",
      evaluationMode: "shadow",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-test-model:generateContent",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-goog-api-key": "gemini-test-key" }),
        signal: expect.any(AbortSignal),
      })
    );
    const request = vi.mocked(global.fetch).mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "low" },
      },
    });
  });

  it("falls back safely when the configured Gemini key is absent", async () => {
    process.env.CRM_AI_PROVIDER = "gemini";
    process.env.OPENAI_API_KEY = "must-not-be-used";
    process.env.CRM_AI_SHADOW_MODE = "true";

    const result = await classifyIntent("Tem estacionamento?");

    expect(result).toMatchObject({
      source: "heuristic",
      intent: "parking",
      result: "fallback_disabled",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("falls back safely for an unsupported provider", async () => {
    process.env.CRM_AI_PROVIDER = "unsupported";
    process.env.OPENAI_API_KEY = "must-not-be-used";
    process.env.CRM_AI_SHADOW_MODE = "true";

    const result = await classifyIntent("Tem estacionamento?");

    expect(result.result).toBe("fallback_disabled");
    expect(global.fetch).not.toHaveBeenCalled();
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
