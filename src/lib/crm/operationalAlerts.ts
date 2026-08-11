import prisma from "@/lib/prisma";
import { getActiveMessagingHealth } from "@/lib/crm/operationalMetrics";

export type OperationalAlert = {
  code: string;
  severity: "warning" | "critical";
  title: string;
  detail: string;
  count?: number;
  lastAt?: string;
};

function minutesBefore(now: Date, minutes: number) {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function metadataResult(value: string | null) {
  try {
    const parsed = JSON.parse(value || "{}") as { result?: unknown };
    return typeof parsed.result === "string" ? parsed.result : "";
  } catch {
    return "";
  }
}

export async function getOperationalAlerts(
  now = new Date(),
  client: typeof prisma = prisma,
  messagingHealthCheck = getActiveMessagingHealth,
) {
  const [webhookFails, stuckQueue, aiDecisions, mapFails, deadLetters, messaging] = await Promise.all([
    client.internalActionLog.findMany({
      where: { action: "WebhookProcessingFailed", createdAt: { gte: minutesBefore(now, 30) } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    client.automationQueueJob.findMany({
      where: { status: "processing", startedAt: { lt: minutesBefore(now, 5) } },
      orderBy: { startedAt: "asc" },
      take: 20,
    }),
    client.internalActionLog.findMany({
      where: { action: "IntentClassified", createdAt: { gte: minutesBefore(now, 30) } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { metadataJson: true, createdAt: true },
    }),
    client.internalActionLog.findMany({
      where: { action: "MapAvailabilityFailed", createdAt: { gte: minutesBefore(now, 30) } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    client.deadLetterQueueItem.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    messagingHealthCheck(),
  ]);

  const alerts: OperationalAlert[] = [];
  if (messaging.status !== "healthy") alerts.push({
    code: "MESSAGING_PROVIDER_UNHEALTHY",
    severity: "critical",
    title: `Provedor ${messaging.provider} indisponível`,
    detail: "O provedor WhatsApp ativo não confirmou uma conexão saudável.",
  });
  if (webhookFails.length) alerts.push({
    code: "WEBHOOK_FAILING", severity: "critical", title: "Falhas recentes no webhook",
    detail: "O webhook registrou erros de processamento nos últimos 30 minutos.", count: webhookFails.length,
    lastAt: webhookFails[0].createdAt.toISOString(),
  });
  if (stuckQueue.length) alerts.push({
    code: "QUEUE_STUCK", severity: "warning", title: "Fila de automação travada",
    detail: "Existem jobs em processamento há mais de cinco minutos.", count: stuckQueue.length,
    lastAt: (stuckQueue[0].startedAt || stuckQueue[0].createdAt).toISOString(),
  });
  const aiFailures = aiDecisions.filter(item => [
    "fallback_provider_error", "fallback_timeout", "fallback_invalid_response",
  ].includes(metadataResult(item.metadataJson)));
  if (aiFailures.length) alerts.push({
    code: "AI_DEGRADED", severity: aiFailures.length >= 5 ? "critical" : "warning", title: "IA operando em fallback",
    detail: "Classificações recentes recorreram ao mecanismo determinístico por falha da IA.", count: aiFailures.length,
    lastAt: aiFailures[0].createdAt.toISOString(),
  });
  if (mapFails.length) alerts.push({
    code: "MAP_UNAVAILABLE", severity: "critical", title: "Falha no Mapa de Tarifas",
    detail: "Consultas internas de tarifa ou disponibilidade falharam recentemente.", count: mapFails.length,
    lastAt: mapFails[0].createdAt.toISOString(),
  });
  if (deadLetters.length) alerts.push({
    code: "DEAD_LETTER_OPEN", severity: deadLetters.length >= 5 ? "critical" : "warning", title: "Itens aguardando recuperação",
    detail: "Existem eventos na dead-letter que ainda não foram reprocessados.", count: deadLetters.length,
    lastAt: deadLetters[0].createdAt.toISOString(),
  });
  return alerts;
}
