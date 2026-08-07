import { parseCrmIntent } from "@/lib/crm/intentParser";
import { parseAiDecision, type AiDecision } from "@/lib/crm/aiDecision";

type SupportedIntent = AiDecision["intent"];

export type IntentClassification = {
  intent: SupportedIntent;
  confidence: number;
  source: "heuristic" | "ai";
  raw?: string;
  decision?: AiDecision;
};

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

async function classifyWithAI(message: string): Promise<IntentClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_LIGHT_MODEL ?? "gpt-4o-mini";

  const prompt = [
    "Classifique a intenção da mensagem de hospedagem.",
    "Categorias: quote,reservation,checkin_info,checkout_info,amenity,pet,parking,location,unknown.",
    "Responda apenas JSON estrito no formato:",
    '{"schemaVersion":1,"intent":"...","confidence":0.0,"suggestedAction":"none|handoff|answer_approved_faq|collect_quote_fields","reasonCode":"recognized_intent|missing_information|sensitive_request|low_confidence|unknown_intent","entities":{}}',
    "Não inclua campos adicionais e não execute nenhuma ação.",
    `Mensagem: ${message}`,
  ].join("\n");

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
  });

  if (!response.ok) return null;
  const data = await response.json().catch(() => null) as any;
  const text = String(data?.output?.[0]?.content?.[0]?.text ?? "").trim();

  if (!text) return null;

  try {
    const decision = parseAiDecision(JSON.parse(text));
    if (!decision) return null;

    return {
      intent: decision.intent,
      confidence: clampConfidence(decision.confidence),
      source: "ai",
      raw: text,
      decision,
    };
  } catch {
    return null;
  }
}

export async function classifyIntent(message: string): Promise<IntentClassification> {
  const ai = process.env.CRM_AI_SHADOW_MODE === "true"
    ? await classifyWithAI(message)
    : null;
  if (ai) return ai;

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
  };
}
