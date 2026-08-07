type FlowData = {
  checkin?: string;
  checkout?: string;
  adults?: number;
  children?: number;
  childrenAges?: number[];
  lastPromptStep?: string;
  lastPromptAt?: string;
  quoteLockUntil?: string;
  validationIssue?: {
    code?: string;
    statedNights?: number;
    calculatedNights?: number;
  };
};

export type QuoteFlowPrompt = {
  step:
    | "waiting_checkin"
    | "waiting_checkout"
    | "waiting_adults"
    | "ready_to_quote"
    | "invalid_checkin"
    | "invalid_checkout"
    | "stay_too_long"
    | "nights_mismatch"
    | "invalid_guests";
  text: string;
};

export const QUOTE_FLOW_TIMEOUT_MS = 30 * 60 * 1000;
export const QUOTE_FLOW_DEBOUNCE_MS = 20 * 1000;

export function parseFlowDataJson(flowDataJson: string | null | undefined): FlowData {
  if (!flowDataJson) return {};
  try {
    const parsed = JSON.parse(flowDataJson) as FlowData;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function shouldExpireQuoteFlow(
  lastAutomationAt: Date | string | null | undefined,
  now = new Date()
): boolean {
  if (!lastAutomationAt) return false;
  const parsed = lastAutomationAt instanceof Date ? lastAutomationAt : new Date(lastAutomationAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return now.getTime() - parsed.getTime() > QUOTE_FLOW_TIMEOUT_MS;
}

export function shouldSkipPromptRepeat(flowData: FlowData, step: string, now = new Date()): boolean {
  if (!flowData.lastPromptStep || flowData.lastPromptStep !== step || !flowData.lastPromptAt) {
    return false;
  }

  const parsed = new Date(flowData.lastPromptAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return now.getTime() - parsed.getTime() < QUOTE_FLOW_DEBOUNCE_MS;
}

export function isQuoteExecutionLocked(flowData: FlowData, now = new Date()): boolean {
  if (!flowData.quoteLockUntil) return false;

  const parsed = new Date(flowData.quoteLockUntil);
  return !Number.isNaN(parsed.getTime()) && parsed > now;
}

export function isQuoteExpired(expiresAt: unknown, now = new Date()): boolean {
  if (typeof expiresAt !== "string" && !(expiresAt instanceof Date)) return true;

  const parsed = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return true;

  return parsed.getTime() <= now.getTime();
}

export function promptForFlowStep(step: string, flowData: FlowData = {}): QuoteFlowPrompt | null {
  if (step === "invalid_checkin") {
    return {
      step: "invalid_checkin",
      text: "A data de check-in informada é inválida ou já passou. Pode me enviar uma nova data, por favor?",
    };
  }

  if (step === "invalid_checkout") {
    return {
      step: "invalid_checkout",
      text: "A data de check-out precisa ser válida e posterior ao check-in. Pode me informar novamente?",
    };
  }

  if (step === "stay_too_long") {
    return {
      step: "stay_too_long",
      text: `A cotação automática aceita períodos de até ${MAX_QUOTE_NIGHTS} noites. Pode informar uma data de check-out mais próxima?`,
    };
  }

  if (step === "nights_mismatch") {
    const stated = flowData.validationIssue?.statedNights;
    const calculated = flowData.validationIssue?.calculatedNights;
    const detail = stated && calculated
      ? `As datas informadas correspondem a ${calculated} ${calculated === 1 ? "diária" : "diárias"}, mas você mencionou ${stated}. `
      : "A quantidade de diárias não corresponde às datas informadas. ";
    return {
      step: "nights_mismatch",
      text: `${detail}Qual é a data correta de check-out?`,
    };
  }

  if (step === "invalid_guests") {
    return {
      step: "invalid_guests",
      text: "A quantidade de hóspedes informada não é válida. Pode me dizer novamente quantos adultos vão se hospedar?",
    };
  }

  if (step === "waiting_checkin") {
    return {
      step: "waiting_checkin",
      text: "Para cotar certinho, me informa a data de check-in, por favor.",
    };
  }

  if (step === "waiting_checkout") {
    return {
      step: "waiting_checkout",
      text: "Perfeito. Agora me informa a data de check-out.",
    };
  }

  if (step === "waiting_adults") {
    return {
      step: "waiting_adults",
      text: "Ótimo. Quantos adultos vão se hospedar?",
    };
  }

  if (step === "ready_to_quote") {
    return {
      step: "ready_to_quote",
      text: "Recebi os dados principais. Vou consultar as opções e já te respondo com o orçamento.",
    };
  }

  return null;
}
import { MAX_QUOTE_NIGHTS } from "@/lib/crm/intentParser";
