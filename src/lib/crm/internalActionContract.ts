import { z } from "zod";

import { PIPELINE_STAGE_ORDER } from "@/lib/crm/pipelineStages";

const identifier = z.string().trim().min(1).max(128);
const shortText = z.string().trim().min(1).max(500);
const messageText = z.string().trim().min(1).max(4096);
const nullableText = z.string().trim().max(500).nullable();
const nullableDate = z.union([
  z.string().trim().min(1).max(64).refine(value => !Number.isNaN(Date.parse(value)), "Data inválida"),
  z.null(),
]);
const nullableNonNegativeNumber = z.number().finite().nonnegative().nullable();
const nullableNonNegativeInteger = z.number().int().nonnegative().max(30).nullable();

const pipelineCardIdPayload = z.object({
  pipelineCardId: identifier,
}).strict();

const markedStatePayload = z.object({
  pipelineCardId: identifier,
  reason: shortText.optional(),
}).strict();

const pausePayload = z.object({
  conversationId: identifier,
  minutes: z.number().int().min(1).max(1440),
  reason: shortText.optional(),
}).strict();

const actionSchemas = {
  MOVE_PIPELINE_CARD: z.object({
    pipelineCardId: identifier,
    toStage: z.enum(PIPELINE_STAGE_ORDER),
    reason: shortText.optional(),
  }).strict(),
  SEND_WHATSAPP_MESSAGE: z.object({
    conversationId: identifier,
    text: messageText,
  }).strict(),
  PAUSE_AUTOMATION: pausePayload,
  SET_CONVERSATION_AUTOMATION_PAUSED: pausePayload,
  UPDATE_LEAD_FIELDS: z.object({
    pipelineCardId: identifier,
    estimatedValue: nullableNonNegativeNumber.optional(),
    intendedArrival: nullableDate.optional(),
    intendedCheckin: nullableDate.optional(),
    intendedCheckout: nullableDate.optional(),
    adults: nullableNonNegativeInteger.refine(value => value === null || value >= 1, "Adultos inválidos").optional(),
    children: nullableNonNegativeInteger.optional(),
    roomTypeInterest: nullableText.optional(),
    lossReason: nullableText.optional(),
    lostReason: nullableText.optional(),
  }).strict()
    .refine(value => Object.keys(value).some(key => key !== "pipelineCardId"), {
      message: "Informe ao menos um campo para atualizar",
    })
    .refine(value => value.lossReason === undefined || value.lostReason === undefined || value.lossReason === value.lostReason, {
      message: "Motivos de perda conflitantes",
    }),
  ADD_CARD_NOTE: z.object({
    pipelineCardId: identifier,
    content: z.string().trim().min(1).max(4000),
  }).strict(),
  SET_CARD_TAGS: z.object({
    pipelineCardId: identifier,
    tags: z.string().trim().min(1).max(1000),
  }).strict(),
  CREATE_FOLLOW_UP_TASK: z.object({
    pipelineCardId: identifier,
    followUpAt: z.string().trim().min(1).max(64).refine(value => !Number.isNaN(Date.parse(value)), "Data inválida"),
  }).strict(),
  MARK_QUOTE_SENT: markedStatePayload,
  MARK_RESERVATION_INTENT: markedStatePayload,
  MARK_PAYMENT_PENDING: markedStatePayload,
  MARK_RESERVATION_CONFIRMED: markedStatePayload,
  REGISTER_UPSELL_OFFER: pipelineCardIdPayload,
  REGISTER_UPSELL_ACCEPTED: pipelineCardIdPayload,
  REGISTER_UPSELL_REJECTED: pipelineCardIdPayload,
} as const;

const pipelineMutationResult = z.object({
  pipelineCardId: identifier,
  stage: z.enum(PIPELINE_STAGE_ORDER),
  stageChanged: z.boolean(),
}).strict();

const actionResultSchemas = {
  MOVE_PIPELINE_CARD: pipelineMutationResult,
  SEND_WHATSAPP_MESSAGE: z.object({
    conversationId: identifier,
    queued: z.literal(true),
    processedNow: z.boolean(),
    queueJobId: z.string().min(1).nullable(),
    deliveryStatus: z.enum(["sent", "queued_failed"]),
    queueError: z.string().min(1).optional(),
  }).strict(),
  PAUSE_AUTOMATION: z.object({
    conversationId: identifier,
    pausedUntil: z.union([z.date(), z.string().datetime()]),
  }).strict(),
  SET_CONVERSATION_AUTOMATION_PAUSED: z.object({
    conversationId: identifier,
    pausedUntil: z.union([z.date(), z.string().datetime()]),
  }).strict(),
  UPDATE_LEAD_FIELDS: z.object({
    pipelineCardId: identifier,
    updatedFields: z.array(z.string().min(1)).min(1),
  }).strict(),
  ADD_CARD_NOTE: z.object({ noteId: identifier }).strict(),
  SET_CARD_TAGS: z.object({ pipelineCardId: identifier, tags: z.string().max(1000) }).strict(),
  CREATE_FOLLOW_UP_TASK: z.object({
    pipelineCardId: identifier,
    followUpAt: z.union([z.date(), z.string().datetime()]),
  }).strict(),
  MARK_QUOTE_SENT: pipelineMutationResult,
  MARK_RESERVATION_INTENT: pipelineMutationResult,
  MARK_PAYMENT_PENDING: pipelineMutationResult,
  MARK_RESERVATION_CONFIRMED: pipelineMutationResult,
  REGISTER_UPSELL_OFFER: z.object({
    pipelineCardId: identifier,
    updatedFields: z.array(z.string().min(1)).min(1),
  }).strict(),
  REGISTER_UPSELL_ACCEPTED: z.object({
    pipelineCardId: identifier,
    updatedFields: z.array(z.string().min(1)).min(1),
  }).strict(),
  REGISTER_UPSELL_REJECTED: z.object({
    pipelineCardId: identifier,
    updatedFields: z.array(z.string().min(1)).min(1),
  }).strict(),
} as const satisfies Record<keyof typeof actionSchemas, z.ZodType>;

export type InternalAction = keyof typeof actionSchemas;

export const INTERNAL_ACTION_ALLOWLIST = Object.freeze(
  Object.keys(actionSchemas) as InternalAction[],
);

export type ParsedInternalAction = {
  [Action in InternalAction]: {
    action: Action;
    payload: z.infer<(typeof actionSchemas)[Action]>;
  }
}[InternalAction];

export function parseInternalAction(input: unknown):
  | { success: true; data: ParsedInternalAction }
  | { success: false; reason: "invalid_envelope" | "unsupported_action" | "invalid_payload" } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, reason: "invalid_envelope" };
  }

  const envelope = input as Record<string, unknown>;
  const envelopeKeys = Object.keys(envelope);
  if (envelopeKeys.some(key => key !== "action" && key !== "payload") || !("payload" in envelope)) {
    return { success: false, reason: "invalid_envelope" };
  }

  if (typeof envelope.action !== "string" || !(envelope.action in actionSchemas)) {
    return { success: false, reason: "unsupported_action" };
  }

  const action = envelope.action as InternalAction;
  const parsedPayload = actionSchemas[action].safeParse(envelope.payload);
  if (!parsedPayload.success) {
    return { success: false, reason: "invalid_payload" };
  }

  return {
    success: true,
    data: { action, payload: parsedPayload.data } as ParsedInternalAction,
  };
}

export function parseInternalActionResult<Action extends InternalAction>(
  action: Action,
  result: unknown,
) {
  return actionResultSchemas[action].parse(result);
}
