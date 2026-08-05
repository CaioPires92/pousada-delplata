import { hasQuoteInput, parseCrmIntent, type CrmInputValidationIssue } from "@/lib/crm/intentParser";

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
  validationIssue?: CrmInputValidationIssue;
  lastPromptStep?: string;
  lastPromptAt?: string;
  quoteLockUntil?: string;
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
  if (data.validationIssue?.field === "checkin") return "invalid_checkin";
  if (data.validationIssue?.field === "checkout" || data.validationIssue?.field === "dateRange") {
    return data.validationIssue.code === "stay_too_long" ? "stay_too_long" : "invalid_checkout";
  }
  if (["adults", "children", "guests"].includes(data.validationIssue?.field ?? "")) {
    return "invalid_guests";
  }
  if (!data.checkin) return "waiting_checkin";
  if (!data.checkout) return "waiting_checkout";
  if (!data.adults) return "waiting_adults";
  return "ready_to_quote";
}

export function buildQuoteFlowState(messageText: string, existing?: ExistingFlow): FlowState {
  const parsed = parseCrmIntent(messageText);
  const containsQuoteInput = hasQuoteInput(parsed);

  if (parsed.intent !== "quote" && !(existing?.currentFlow === "quote" && containsQuoteInput)) {
    return {
      currentFlow: existing?.currentFlow ?? null,
      flowStep: existing?.flowStep ?? null,
      flowDataJson: existing?.flowDataJson ?? null,
      shouldTouchAutomationTime: false,
    };
  }

  const priorData = safeParseFlowData(existing?.flowDataJson);
  const firstIssue = parsed.validationIssues[0];
  const validationIssue = existing?.flowStep === "waiting_checkout" && firstIssue?.field === "checkin"
    ? { ...firstIssue, field: "checkout" as const }
    : firstIssue;
  const isCheckoutOnlyReply = existing?.flowStep === "waiting_checkout" && parsed.checkin && !parsed.checkout;
  const incomingCheckin = isCheckoutOnlyReply ? undefined : parsed.checkin;
  const incomingCheckout = isCheckoutOnlyReply ? parsed.checkin : parsed.checkout;
  const mergedData: FlowData = {
    ...priorData,
    checkin: validationIssue?.field === "checkin" ? undefined : incomingCheckin ?? priorData.checkin,
    checkout: validationIssue && ["checkin", "checkout", "dateRange"].includes(validationIssue.field)
      ? undefined
      : incomingCheckout ?? priorData.checkout,
    adults: validationIssue && ["adults", "guests"].includes(validationIssue.field)
      ? undefined
      : parsed.adults ?? priorData.adults,
    children: parsed.children ?? priorData.children,
    childrenAges: (parsed.childrenAges?.length ?? 0) > 0 ? parsed.childrenAges : priorData.childrenAges,
    validationIssue,
  };

  return {
    currentFlow: "quote",
    flowStep: nextFlowStep(mergedData),
    flowDataJson: JSON.stringify(mergedData),
    shouldTouchAutomationTime: true,
  };
}
