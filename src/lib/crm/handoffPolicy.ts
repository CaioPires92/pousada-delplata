import { hasQuoteInput, parseCrmIntent, type ParsedCrmIntent } from "@/lib/crm/intentParser";

export type AutomationHandoffReason =
  | "human_requested"
  | "complaint_or_emergency"
  | "cancellation_or_refund"
  | "low_confidence"
  | "repeated_failure"
  | "intent_not_released"
  | "prompt_injection"
  | "sensitive_request"
  | "commercial_exception"
  | "unknown_intent";

export type AutomationHandoffDecision = {
  shouldHandoff: boolean;
  reason?: AutomationHandoffReason;
  message?: string;
};

export const DEFAULT_AUTOMATION_HANDOFF_MESSAGE =
  "Só um momento, por favor. Vou confirmar essa informação com nossa equipe e retorno por aqui.";

export const DEFAULT_AUTOMATION_CLARIFICATION_MESSAGE =
  "Não consegui entender sua mensagem. Pode reformular, por favor?";

const HUMAN_REQUEST = /\b(atendente|humano|pessoa|recep[cç][aã]o|falar com algu[eé]m)\b/i;
const COMPLAINT_OR_EMERGENCY = /\b(emerg[eê]ncia|urgente|acidente|problema|reclama[cç][aã]o|insatisfeit|p[eé]ssim|pessim)\b/i;
const CANCELLATION_OR_REFUND = /\b(cancelar|cancelamento|reembolso|estorno|devolver dinheiro)\b/i;
const PROMPT_INJECTION = /\b(ignore (?:as |todas as )?instru[cç][oõ]es|prompt do sistema|system prompt|revele (?:seu|o) prompt|modo desenvolvedor)\b/i;
const SENSITIVE_REQUEST = /\b(senha (?:do|de) sistema|senha administrativa|token de acesso|chave (?:da )?api|c[oó]digo de seguran[cç]a do cart[aã]o)\b/i;
const COMMERCIAL_EXCEPTION = /\b(desconto|cortesia|abatimento|pre[cç]o especial|promo[cç][aã]o exclusiva)\b/i;

export function decideAutomationHandoff(
  message: string,
  parsed: ParsedCrmIntent = parseCrmIntent(message),
  options: { consecutiveFailures?: number; confidence?: number } = {},
): AutomationHandoffDecision {
  if (HUMAN_REQUEST.test(message)) {
    return { shouldHandoff: true, reason: "human_requested", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
  }

  if (COMPLAINT_OR_EMERGENCY.test(message)) {
    return { shouldHandoff: true, reason: "complaint_or_emergency", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
  }

  if (CANCELLATION_OR_REFUND.test(message)) {
    return { shouldHandoff: true, reason: "cancellation_or_refund", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
  }

  if (PROMPT_INJECTION.test(message)) {
    return { shouldHandoff: true, reason: "prompt_injection", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
  }

  if (SENSITIVE_REQUEST.test(message)) {
    return { shouldHandoff: true, reason: "sensitive_request", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
  }

  if (COMMERCIAL_EXCEPTION.test(message)) {
    return { shouldHandoff: true, reason: "commercial_exception", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
  }

  if (typeof options.confidence === "number" && options.confidence < 0.5) {
    return { shouldHandoff: true, reason: "low_confidence", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
  }

  if (parsed.intent === "unknown" && !hasQuoteInput(parsed)) {
    const consecutiveFailures = Math.max(0, options.consecutiveFailures ?? 0) + 1;
    if (consecutiveFailures >= 2) {
      return { shouldHandoff: true, reason: "repeated_failure", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
    }
    return { shouldHandoff: false, reason: "unknown_intent", message: DEFAULT_AUTOMATION_CLARIFICATION_MESSAGE };
  }

  return { shouldHandoff: false };
}
