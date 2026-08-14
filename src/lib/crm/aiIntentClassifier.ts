import { parseCrmIntent } from "@/lib/crm/intentParser";
import { parseAiDecision, type AiDecision } from "@/lib/crm/aiDecision";
import { CRM_AI_PROMPT_VERSION, CRM_HEURISTIC_MODEL_VERSION } from "@/lib/crm/automationVersions";

type SupportedIntent = AiDecision["intent"];

export type IntentClassification = {
  intent: SupportedIntent;
  confidence: number;
  source: "heuristic" | "ai";
  raw?: string;
  decision?: AiDecision;
  model: string;
  promptVersion?: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  providerHttpStatus?: number | null;
  providerErrorCode?: "rate_limited" | "authentication_failed" | "request_rejected" | null;
  result: "classified" | "deterministic" | "fallback_disabled" | "fallback_provider_error" | "fallback_invalid_response" | "fallback_timeout";
  evaluationMode: "deterministic" | "shadow";
};

type AiAttempt = {
  classification: IntentClassification | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  providerHttpStatus?: number | null;
  providerErrorCode?: IntentClassification["providerErrorCode"];
  result: IntentClassification["result"];
};

type AiProviderConfig = {
  provider: "openai" | "gemini";
  apiKey: string;
  model: string;
  url: string;
};

const GEMINI_AI_DECISION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "intent", "confidence", "suggestedAction", "reasonCode", "entities"],
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    intent: {
      type: "string",
      enum: ["quote", "reservation", "checkin_info", "checkout_info", "amenity", "pet", "parking", "location", "unknown"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    suggestedAction: {
      type: "string",
      enum: ["none", "handoff", "answer_approved_faq", "collect_quote_fields"],
    },
    reasonCode: {
      type: "string",
      enum: ["recognized_intent", "missing_information", "sensitive_request", "low_confidence", "unknown_intent"],
    },
    entities: {
      type: "object",
      additionalProperties: false,
      properties: {
        checkin: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        checkout: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        adults: { type: "integer", minimum: 1, maximum: 30 },
        children: { type: "integer", minimum: 0, maximum: 30 },
        childrenAges: {
          type: "array",
          maxItems: 30,
          items: { type: "integer", minimum: 0, maximum: 17 },
        },
      },
    },
  },
} as const;

function getAiProviderConfig(): AiProviderConfig | null {
  const provider = (process.env.CRM_AI_PROVIDER ?? "openai").trim().toLowerCase();

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
    return {
      provider,
      apiKey,
      model,
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    };
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;

    return {
      provider,
      apiKey,
      model: process.env.OPENAI_LIGHT_MODEL?.trim() || "gpt-4o-mini",
      url: "https://api.openai.com/v1/responses",
    };
  }

  return null;
}

function providerRequest(config: AiProviderConfig, prompt: string): RequestInit {
  if (config.provider === "gemini") {
    const thinkingConfig = config.model.startsWith("gemini-3")
      ? { thinkingLevel: "low" }
      : { thinkingBudget: 0 };

    return {
      method: "POST",
      headers: {
        "x-goog-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseJsonSchema: GEMINI_AI_DECISION_JSON_SCHEMA,
          thinkingConfig,
        },
      }),
      signal: AbortSignal.timeout(aiTimeoutMs(5000)),
    };
  }

  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: prompt,
      max_output_tokens: 120,
    }),
    signal: AbortSignal.timeout(aiTimeoutMs(1500)),
  };
}

function providerResponse(data: any, provider: AiProviderConfig["provider"]) {
  if (provider === "gemini") {
    return {
      text: String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim(),
      inputTokens: Number.isFinite(data?.usageMetadata?.promptTokenCount)
        ? Number(data.usageMetadata.promptTokenCount)
        : null,
      outputTokens: Number.isFinite(data?.usageMetadata?.candidatesTokenCount)
        ? Number(data.usageMetadata.candidatesTokenCount)
        : null,
    };
  }

  return {
    text: String(data?.output_text ?? data?.output?.[0]?.content?.[0]?.text ?? "").trim(),
    inputTokens: Number.isFinite(data?.usage?.input_tokens) ? Number(data.usage.input_tokens) : null,
    outputTokens: Number.isFinite(data?.usage?.output_tokens) ? Number(data.usage.output_tokens) : null,
  };
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function aiTimeoutMs(defaultValue: number) {
  const configured = Number.parseInt(process.env.CRM_AI_TIMEOUT_MS ?? String(defaultValue), 10);
  if (!Number.isFinite(configured)) return defaultValue;
  return Math.max(250, Math.min(5000, configured));
}

async function classifyWithAI(message: string): Promise<AiAttempt> {
  const startedAt = Date.now();
  const providerConfig = getAiProviderConfig();
  if (!providerConfig) {
    return {
      classification: null,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      result: "fallback_disabled",
    };
  }

  const prompt = [
    "Classifique a intenção da mensagem de hospedagem.",
    "Categorias: quote,reservation,checkin_info,checkout_info,amenity,pet,parking,location,unknown.",
    "Responda apenas JSON estrito no formato:",
    '{"schemaVersion":1,"intent":"...","confidence":0.0,"suggestedAction":"none|handoff|answer_approved_faq|collect_quote_fields","reasonCode":"recognized_intent|missing_information|sensitive_request|low_confidence|unknown_intent","entities":{}}',
    "Não inclua campos adicionais e não execute nenhuma ação.",
    `Mensagem: ${message}`,
  ].join("\n");

  try {
    const response = await fetch(
      providerConfig.url,
      providerRequest(providerConfig, prompt)
    );

    if (!response.ok) {
      const providerHttpStatus = response.status || null;
      const providerErrorCode = providerHttpStatus === 429
        ? "rate_limited"
        : providerHttpStatus === 401 || providerHttpStatus === 403
          ? "authentication_failed"
          : "request_rejected";
      return {
        classification: null,
        latencyMs: Date.now() - startedAt,
        inputTokens: null,
        outputTokens: null,
        providerHttpStatus,
        providerErrorCode,
        result: "fallback_provider_error",
      };
    }
    const data = await response.json().catch(() => null) as any;
    const { text, inputTokens, outputTokens } = providerResponse(data, providerConfig.provider);
    if (!text) {
      return {
        classification: null,
        latencyMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
        result: "fallback_invalid_response",
      };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return {
        classification: null,
        latencyMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
        result: "fallback_invalid_response",
      };
    }

    const decision = parseAiDecision(parsedJson);
    if (!decision) {
      return {
        classification: null,
        latencyMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
        result: "fallback_invalid_response",
      };
    }

    const latencyMs = Date.now() - startedAt;
    return {
      classification: {
        intent: decision.intent,
        confidence: clampConfidence(decision.confidence),
        source: "ai",
        raw: text,
        decision,
        model: providerConfig.model,
        promptVersion: CRM_AI_PROMPT_VERSION,
        latencyMs,
        inputTokens,
        outputTokens,
        result: "classified",
        evaluationMode: "shadow",
      },
      latencyMs,
      inputTokens,
      outputTokens,
      result: "classified",
    };
  } catch (error) {
    return {
      classification: null,
      latencyMs: Date.now() - startedAt,
      inputTokens: null,
      outputTokens: null,
      result: error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")
        ? "fallback_timeout"
        : "fallback_provider_error",
    };
  }
}

export async function classifyIntent(message: string): Promise<IntentClassification> {
  const startedAt = Date.now();
  const shadowEnabled = process.env.CRM_AI_SHADOW_MODE === "true";
  const aiAttempt = shadowEnabled ? await classifyWithAI(message) : null;
  if (aiAttempt?.classification) return aiAttempt.classification;

  const parsed = parseCrmIntent(message);
  const confidenceMap: Record<string, number> = {
    low: 0.4,
    medium: 0.65,
    high: 0.85,
  };

  return {
    intent: parsed.intent,
    confidence: confidenceMap[parsed.confidence] ?? 0.5,
    source: "heuristic",
    model: CRM_HEURISTIC_MODEL_VERSION,
    latencyMs: aiAttempt?.latencyMs ?? Date.now() - startedAt,
    inputTokens: aiAttempt?.inputTokens ?? null,
    outputTokens: aiAttempt?.outputTokens ?? null,
    providerHttpStatus: aiAttempt?.providerHttpStatus ?? null,
    providerErrorCode: aiAttempt?.providerErrorCode ?? null,
    result: aiAttempt?.result ?? (shadowEnabled ? "fallback_disabled" : "deterministic"),
    evaluationMode: shadowEnabled ? "shadow" : "deterministic",
  };
}
