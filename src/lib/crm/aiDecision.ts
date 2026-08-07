import { z } from "zod";

export const AI_DECISION_SCHEMA_VERSION = 1 as const;

export const AI_INTENTS = [
  "quote",
  "reservation",
  "checkin_info",
  "checkout_info",
  "amenity",
  "pet",
  "parking",
  "location",
  "unknown",
] as const;

export const AI_SUGGESTED_ACTIONS = [
  "none",
  "handoff",
  "answer_approved_faq",
  "collect_quote_fields",
] as const;

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const aiDecisionSchema = z.object({
  schemaVersion: z.literal(AI_DECISION_SCHEMA_VERSION),
  intent: z.enum(AI_INTENTS),
  confidence: z.number().min(0).max(1),
  suggestedAction: z.enum(AI_SUGGESTED_ACTIONS),
  reasonCode: z.enum([
    "recognized_intent",
    "missing_information",
    "sensitive_request",
    "low_confidence",
    "unknown_intent",
  ]),
  entities: z.object({
    checkin: dayKeySchema.optional(),
    checkout: dayKeySchema.optional(),
    adults: z.number().int().min(1).max(30).optional(),
    children: z.number().int().min(0).max(30).optional(),
    childrenAges: z.array(z.number().int().min(0).max(17)).max(30).optional(),
  }).strict(),
}).strict();

export type AiDecision = z.infer<typeof aiDecisionSchema>;

export function parseAiDecision(value: unknown): AiDecision | null {
  const result = aiDecisionSchema.safeParse(value);
  return result.success ? result.data : null;
}
