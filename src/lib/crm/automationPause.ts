export const DEFAULT_AUTOMATION_PAUSE_MINUTES = 30;
export const AUTOMATION_MODES = ["off", "supervised", "auto"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

type AutomationState = {
  chatbotEnabled: boolean;
  automationMode?: string | null;
  automationPausedUntil: Date | string | null;
} | null | undefined;

export function isAutomationMode(value: unknown): value is AutomationMode {
  return typeof value === "string" && AUTOMATION_MODES.includes(value as AutomationMode);
}

export function resolveAutomationMode(conversation: AutomationState): AutomationMode {
  if (isAutomationMode(conversation?.automationMode)) {
    return conversation.automationMode;
  }

  return conversation?.chatbotEnabled ? "auto" : "off";
}

export function createAutomationPausedUntil(
  now = new Date(),
  pauseMinutes = DEFAULT_AUTOMATION_PAUSE_MINUTES
) {
  return new Date(now.getTime() + pauseMinutes * 60 * 1000);
}

export function isAutomationPaused(
  automationPausedUntil: Date | string | null | undefined,
  now = new Date()
) {
  if (!automationPausedUntil) return false;

  const pausedUntil = automationPausedUntil instanceof Date
    ? automationPausedUntil
    : new Date(automationPausedUntil);

  return !Number.isNaN(pausedUntil.getTime()) && pausedUntil > now;
}

export function isConversationAutomationActive(
  conversation: AutomationState,
  now = new Date()
) {
  return Boolean(
    resolveAutomationMode(conversation) === "auto" &&
      conversation?.chatbotEnabled &&
      !isAutomationPaused(conversation.automationPausedUntil, now)
  );
}
