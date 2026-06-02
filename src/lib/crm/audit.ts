export type AuditOrigin = "human_api" | "n8n_api" | "system" | "webhook" | "admin_ui";
export type AuditActorType = "human" | "n8n" | "system" | "webhook";

export function buildAuditMetadata(input: {
  actorType: AuditActorType;
  origin: AuditOrigin;
  actorId?: string | null;
  reason?: string | null;
  extra?: Record<string, unknown>;
}) {
  return {
    actorType: input.actorType,
    origin: input.origin,
    actorId: input.actorId ?? null,
    reason: input.reason ?? null,
    ...(input.extra ?? {}),
  };
}
