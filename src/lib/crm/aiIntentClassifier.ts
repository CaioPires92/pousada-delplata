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
  result: "classified" | "deterministic" | "fallback_disabled" | "fallback_provider_error" | "fallback_invalid_response" | "fallback_timeout";
  evaluationMode: "deterministic" | "shadow";
};

type AiAttempt = {
  classification: IntentClassification | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  result: IntentClassification["result"];
};

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function aiTimeoutMs() {
  const configured = Number.parseInt(process.env.CRM_AI_TIMEOUT_MS ?? "1500", 10);
  if (!Number.isFinite(configured)) return 1500;
  return Math.max(250, Math.min(5000, configured));
}

async function classifyWithAI(message: string): Promise<AiAttempt> {
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      classification: null,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      result: "fallback_disabled",
    };
  }

  const model = process.env.OPENAI_LIGHT_MODEL ?? "gpt-4o-mini";

  const prompt = [
    "Classifique a intenção da mensagem de hospedagem.",
    "Categorias: quote,reservation,checkin_info,checkout_info,amenity,pet,parking,location,unknown.",
    "Responda apenas JSON estrito no formato:",
    '{"schemaVersion":1,"intent":"...","confidence":0.0,"suggestedAction":"none|handoff|answer_approved_faq|collect_quote_fields","reasonCode":"recognized_intent|missing_information|sensitive_request|low_confidence|unknown_intent","entities":{}}',
    "Não inclua campos adicionais e não execute nenhuma ação.",
    `Mensagem: ${message}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 120,
      }),
      signal: AbortSignal.timeout(aiTimeoutMs()),
    });

    if (!response.ok) {
      return {
        classification: null,
        latencyMs: Date.now() - startedAt,
        inputTokens: null,
        outputTokens: null,
        result: "fallback_provider_error",
      };
    }
    const data = await response.json().catch(() => null) as any;
    const text = String(data?.output_text ?? data?.output?.[0]?.content?.[0]?.text ?? "").trim();
    const inputTokens = Number.isFinite(data?.usage?.input_tokens) ? Number(data.usage.input_tokens) : null;
    const outputTokens = Number.isFinite(data?.usage?.output_tokens) ? Number(data.usage.output_tokens) : null;
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
        model,
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
    result: aiAttempt?.result ?? (shadowEnabled ? "fallback_disabled" : "deterministic"),
    evaluationMode: shadowEnabled ? "shadow" : "deterministic",
  };
}
