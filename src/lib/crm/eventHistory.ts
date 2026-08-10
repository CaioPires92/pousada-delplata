export type CrmEventMetadata = Record<string, unknown>;

const ACTOR_LABELS: Record<string, string> = {
  human: "Atendimento humano",
  n8n: "Automação n8n",
  system: "Sistema",
  webhook: "WhatsApp",
};

const ORIGIN_LABELS: Record<string, string> = {
  admin_ui: "Painel administrativo",
  human_api: "Ação da equipe",
  n8n_api: "n8n",
  system: "Processamento interno",
  webhook: "Webhook do WhatsApp",
};

function metadataString(metadata: CrmEventMetadata | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseCrmEventMetadata(value: string | null): CrmEventMetadata | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as CrmEventMetadata
      : null;
  } catch {
    return null;
  }
}

export function describeCrmEventAudit(metadata: CrmEventMetadata | null) {
  const actorType = metadataString(metadata, "actorType");
  const actorId = metadataString(metadata, "actorId");
  const origin = metadataString(metadata, "origin");
  const reason = metadataString(metadata, "reason");

  return {
    actorType,
    actorId,
    actorLabel: actorId
      ? `${ACTOR_LABELS[actorType ?? ""] ?? actorType ?? "Responsável não informado"} (${actorId})`
      : ACTOR_LABELS[actorType ?? ""] ?? actorType ?? "Responsável não informado",
    origin,
    originLabel: ORIGIN_LABELS[origin ?? ""] ?? origin ?? "Origem não informada",
    reason,
  };
}

export function formatCrmEventDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
