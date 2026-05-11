export const DEFAULT_AUTOMATION_PAUSE_MINUTES = 30;

type AutomationState = {
  chatbotEnabled: boolean;
  automationPausedUntil: Date | string | null;
} | null | undefined;

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
    conversation?.chatbotEnabled &&
      !isAutomationPaused(conversation.automationPausedUntil, now)
  );
}
