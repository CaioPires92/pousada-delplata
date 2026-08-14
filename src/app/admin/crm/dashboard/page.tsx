import prisma from "@/lib/prisma";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_ORDER } from "@/lib/crm/pipelineStages";
import { getCrmOperationalMetrics } from "@/lib/crm/operationalMetrics";
import { DeadLetterPanel } from "./DeadLetterPanel";

function periodStart(scope: "daily" | "weekly") {
  const now = new Date();
  if (scope === "daily") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export default async function CrmDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = params.scope === "daily" ? "daily" : "weekly";
  const since = periodStart(scope);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [cardsCreated, cardsConfirmed, cardsLost, bySource, byLostReason, byStage, quoteSent, reservationStarted, alerts, operational] = await Promise.all([
    prisma.pipelineCard.count({ where: { createdAt: { gte: since } } }),
    prisma.pipelineCard.count({ where: { createdAt: { gte: since }, stage: "RESERVA_CONFIRMADA" } }),
    prisma.pipelineCard.count({ where: { createdAt: { gte: since }, stage: "PERDIDO" } }),
    prisma.pipelineCard.groupBy({ by: ["source"], where: { createdAt: { gte: since } }, _count: { source: true } }),
    prisma.pipelineCard.groupBy({ by: ["lossReason"], where: { createdAt: { gte: since }, lossReason: { not: null } }, _count: { lossReason: true } }),
    prisma.pipelineCard.groupBy({ by: ["stage"], _count: { stage: true } }),
    prisma.internalActionLog.count({ where: { action: "QuoteSent", createdAt: { gte: since } } }),
    prisma.internalActionLog.count({ where: { action: "ReservationStarted", createdAt: { gte: since } } }),
    prisma.internalActionLog.findMany({
      where: {
        action: { in: ["WhatsAppSendFailed", "WebhookProcessingFailed"] },
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getCrmOperationalMetrics(since, now),
  ]);

  const conversionRate = cardsCreated > 0 ? Number(((cardsConfirmed / cardsCreated) * 100).toFixed(2)) : 0;
  const quoteToReservationRate = quoteSent > 0 ? Number(((reservationStarted / quoteSent) * 100).toFixed(2)) : 0;

  const funnel = PIPELINE_STAGE_ORDER.map(stage => ({
    stage,
    count: byStage.find(item => item.stage === stage)?._count.stage ?? 0,
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CRM Dashboard Operacional</h1>
          <p className="text-sm text-slate-600">Visão {scope === "daily" ? "diária" : "semanal"} com funil e alertas de operação.</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/crm/dashboard?scope=daily" className={`rounded px-3 py-2 text-sm ${scope === "daily" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>Diário</a>
          <a href="/admin/crm/dashboard?scope=weekly" className={`rounded px-3 py-2 text-sm ${scope === "weekly" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>Semanal</a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Leads</p><p className="text-2xl font-semibold">{cardsCreated}</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Conversão</p><p className="text-2xl font-semibold">{conversionRate}%</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Quote → Reserva</p><p className="text-2xl font-semibold">{quoteToReservationRate}%</p></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-xs text-slate-500">Perdidos</p><p className="text-2xl font-semibold">{cardsLost}</p></div>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Saúde da operação</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            operational.health === "healthy"
              ? "bg-emerald-100 text-emerald-800"
              : operational.health === "warning"
                ? "bg-amber-100 text-amber-800"
                : "bg-red-100 text-red-800"
          }`}>
            {operational.health === "healthy" ? "Saudável" : operational.health === "warning" ? "Atenção" : "Crítico"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded border border-slate-100 p-3">
            <p className="text-xs text-slate-500">WhatsApp</p>
            <p className="text-xl font-semibold capitalize">{operational.messaging.status === "healthy" ? "Conectado" : "Indisponível"}</p>
            <p className="text-xs text-slate-400 capitalize">{operational.messaging.provider}</p>
          </div>
          <div className="rounded border border-slate-100 p-3">
            <p className="text-xs text-slate-500">Latência média IA</p>
            <p className="text-xl font-semibold">{operational.latency.averageMs === null ? "—" : `${operational.latency.averageMs} ms`}</p>
            <p className="text-xs text-slate-400">p95 {operational.latency.p95Ms === null ? "—" : `${operational.latency.p95Ms} ms`}</p>
          </div>
          <div className="rounded border border-slate-100 p-3"><p className="text-xs text-slate-500">Erros no período</p><p className="text-xl font-semibold">{operational.errors.total}</p></div>
          <div className="rounded border border-slate-100 p-3"><p className="text-xs text-slate-500">Jobs atrasados</p><p className="text-xl font-semibold">{operational.queue.overdueJobs}</p></div>
          <div className="rounded border border-slate-100 p-3"><p className="text-xs text-slate-500">Fila / dead-letter</p><p className="text-xl font-semibold">{operational.queue.overdueJobs} / {operational.queue.openDeadLetters}</p></div>
          <div className="rounded border border-slate-100 p-3">
            <p className="text-xs text-slate-500">Custo estimado IA</p>
            <p className="text-xl font-semibold">{operational.aiCost.configured ? `US$ ${operational.aiCost.estimatedCostUsd?.toFixed(4)}` : "Não configurado"}</p>
            <p className="text-xs text-slate-400">{operational.aiCost.inputTokens + operational.aiCost.outputTokens} tokens</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Funil Comercial</h2>
          <div className="space-y-2">
            {funnel.map(item => (
              <div key={item.stage} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
                <span className="text-sm text-slate-700">{PIPELINE_STAGE_LABELS[item.stage]}</span>
                <span className="text-sm font-semibold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Leads por origem</h2>
          <div className="space-y-2">
            {bySource.length === 0 ? <p className="text-sm text-slate-500">Sem dados no período.</p> : bySource.map(item => (
              <div key={String(item.source)} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
                <span className="text-sm text-slate-700">{item.source || "unknown"}</span>
                <span className="text-sm font-semibold text-slate-900">{item._count.source}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Motivos de perda</h2>
          <div className="space-y-2">
            {byLostReason.length === 0 ? <p className="text-sm text-slate-500">Sem perdas categorizadas no período.</p> : byLostReason.map(item => (
              <div key={String(item.lossReason)} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
                <span className="text-sm text-slate-700">{item.lossReason || "sem motivo"}</span>
                <span className="text-sm font-semibold text-slate-900">{item._count.lossReason}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Alertas básicos (1h)</h2>
          <div className="space-y-2">
            {alerts.length === 0 ? <p className="text-sm text-emerald-700">Sem alertas no período.</p> : alerts.map(alert => (
              <div key={alert.id} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-semibold">{alert.action}</p>
                <p className="text-xs opacity-80">{new Date(alert.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <DeadLetterPanel />
    </div>
  );
}
