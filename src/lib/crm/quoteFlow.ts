type FlowData = {
  checkin?: string;
  checkout?: string;
  adults?: number;
  children?: number;
  childrenAges?: number[];
  lastPromptStep?: string;
  lastPromptAt?: string;
  quoteLockUntil?: string;
};

export type QuoteFlowPrompt = {
  step: "waiting_checkin" | "waiting_checkout" | "waiting_adults" | "ready_to_quote";
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

export function promptForFlowStep(step: string): QuoteFlowPrompt | null {
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
