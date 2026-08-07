import { hasQuoteInput, parseCrmIntent, type ParsedCrmIntent } from "@/lib/crm/intentParser";

export type AutomationHandoffReason =
  | "human_requested"
  | "complaint_or_emergency"
  | "cancellation_or_refund"
  | "unknown_intent";

export type AutomationHandoffDecision = {
  shouldHandoff: boolean;
  reason?: AutomationHandoffReason;
  message?: string;
};

export const DEFAULT_AUTOMATION_HANDOFF_MESSAGE =
  "Só um momento, por favor. Vou confirmar essa informação com nossa equipe e retorno por aqui.";

const HUMAN_REQUEST = /\b(atendente|humano|pessoa|recep[cç][aã]o|falar com algu[eé]m)\b/i;
const COMPLAINT_OR_EMERGENCY = /\b(emerg[eê]ncia|urgente|acidente|problema|reclama[cç][aã]o|insatisfeit|p[eé]ssim|pessim)\b/i;
const CANCELLATION_OR_REFUND = /\b(cancelar|cancelamento|reembolso|estorno|devolver dinheiro)\b/i;

export function decideAutomationHandoff(
  message: string,
  parsed: ParsedCrmIntent = parseCrmIntent(message)
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

  if (parsed.intent === "unknown" && !hasQuoteInput(parsed)) {
    return { shouldHandoff: true, reason: "unknown_intent", message: DEFAULT_AUTOMATION_HANDOFF_MESSAGE };
  }

  return { shouldHandoff: false };
}
