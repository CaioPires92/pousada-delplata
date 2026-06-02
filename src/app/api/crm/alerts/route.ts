import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

type AlertSeverity = "warning" | "critical";

type AlertItem = {
  code: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  count?: number;
  lastAt?: string;
};

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

export async function GET() {
  try {
    const [recentSendFails, recentN8nFails, recentWebhookFails, stuckQueue] = await Promise.all([
      prisma.internalActionLog.findMany({
        where: {
          action: "WhatsAppSendFailed",
          createdAt: { gte: minutesAgo(15) },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.internalActionLog.findMany({
        where: {
          action: "N8NEmitFailed",
          createdAt: { gte: minutesAgo(30) },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.internalActionLog.findMany({
        where: {
          action: "WebhookProcessingFailed",
          createdAt: { gte: minutesAgo(30) },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.automationQueueJob.findMany({
        where: {
          status: "processing",
          startedAt: { lt: minutesAgo(5) },
        },
        orderBy: { startedAt: "asc" },
        take: 20,
      }),
    ]);

    const alerts: AlertItem[] = [];

    if (recentSendFails.length > 0) {
      alerts.push({
        code: "EVOLUTION_OFFLINE",
        severity: "critical",
        title: "Falhas recentes na Evolution API",
        detail: "Foram detectadas falhas de envio WhatsApp no período recente.",
        count: recentSendFails.length,
        lastAt: recentSendFails[0].createdAt.toISOString(),
      });
    }

    if (recentN8nFails.length > 0) {
      alerts.push({
        code: "N8N_OFFLINE",
        severity: "warning",
        title: "Falhas recentes de emissão para n8n",
        detail: "Eventos do CRM não foram entregues ao n8n em algumas tentativas.",
        count: recentN8nFails.length,
        lastAt: recentN8nFails[0].createdAt.toISOString(),
      });
    }

    if (recentWebhookFails.length > 0) {
      alerts.push({
        code: "WEBHOOK_FAILING",
        severity: "critical",
        title: "Falhas recentes no processamento de webhook",
        detail: "O webhook recebeu payloads com erro de processamento.",
        count: recentWebhookFails.length,
        lastAt: recentWebhookFails[0].createdAt.toISOString(),
      });
    }

    if (stuckQueue.length > 0) {
      alerts.push({
        code: "QUEUE_STUCK",
        severity: "warning",
        title: "Fila de automação travada",
        detail: "Existem jobs em processamento há mais de 5 minutos.",
        count: stuckQueue.length,
        lastAt: (stuckQueue[0].startedAt ?? stuckQueue[0].createdAt).toISOString(),
      });
    }

    return NextResponse.json({ ok: true, alerts });
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
