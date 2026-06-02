import { parseCrmIntent } from "@/lib/crm/intentParser";

type FlowState = {
  currentFlow: string | null;
  flowStep: string | null;
  flowDataJson: string | null;
  shouldTouchAutomationTime: boolean;
};

type ExistingFlow = {
  currentFlow?: string | null;
  flowStep?: string | null;
  flowDataJson?: string | null;
};

type FlowData = {
  checkin?: string;
  checkout?: string;
  adults?: number;
  children?: number;
  childrenAges?: number[];
};

function safeParseFlowData(value: string | null | undefined): FlowData {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as FlowData;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function nextFlowStep(data: FlowData) {
  if (!data.checkin) return "waiting_checkin";
  if (!data.checkout) return "waiting_checkout";
  if (!data.adults) return "waiting_adults";
  return "ready_to_quote";
}

export function buildQuoteFlowState(messageText: string, existing?: ExistingFlow): FlowState {
  const parsed = parseCrmIntent(messageText);

  if (parsed.intent !== "quote") {
    return {
      currentFlow: existing?.currentFlow ?? null,
      flowStep: existing?.flowStep ?? null,
      flowDataJson: existing?.flowDataJson ?? null,
      shouldTouchAutomationTime: false,
    };
  }

  const priorData = safeParseFlowData(existing?.flowDataJson);
  const mergedData: FlowData = {
    checkin: parsed.checkin ?? priorData.checkin,
    checkout: parsed.checkout ?? priorData.checkout,
    adults: parsed.adults ?? priorData.adults,
    children: parsed.children ?? priorData.children,
    childrenAges: (parsed.childrenAges?.length ?? 0) > 0 ? parsed.childrenAges : priorData.childrenAges,
  };

  return {
    currentFlow: "quote",
    flowStep: nextFlowStep(mergedData),
    flowDataJson: JSON.stringify(mergedData),
    shouldTouchAutomationTime: true,
  };
}
