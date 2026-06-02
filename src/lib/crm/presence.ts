export type ConversationPresence = {
  isOnline: boolean;
  typing: boolean;
  lastSeenAt: string | null;
  delivery: {
    sent: boolean;
    read: boolean;
    note: string;
  };
};

export function inferPresenceFromLastGuestMessage(lastGuestMessageAt: Date | string | null | undefined): ConversationPresence {
  const now = Date.now();
  const parsed = lastGuestMessageAt ? new Date(lastGuestMessageAt) : null;
  const isValid = Boolean(parsed && !Number.isNaN(parsed.getTime()));
  const lastSeenMs = isValid ? parsed!.getTime() : null;

  // Presença conservadora: "online" apenas se houve atividade recente real.
  const isOnline = Boolean(lastSeenMs && now - lastSeenMs <= 2 * 60 * 1000);

  return {
    isOnline,
    typing: false,
    lastSeenAt: isValid ? parsed!.toISOString() : null,
    delivery: {
      sent: true,
      read: false,
      note: "Status de leitura ainda não confiável na integração atual.",
    },
  };
}
