import prisma from "@/lib/prisma";

type Severity = "INFO" | "WARN" | "ERROR" | "AUTOMATION" | "SECURITY";

function inferSeverity(action: string): Severity {
  const normalized = action.toLowerCase();
  if (normalized.includes("unauthorized") || normalized.includes("security")) return "SECURITY";
  if (normalized.includes("error") || normalized.includes("failed") || normalized.includes("failure")) return "ERROR";
  if (normalized.includes("debounced") || normalized.includes("timedout") || normalized.includes("prompt") || normalized.includes("quote")) return "AUTOMATION";
  if (normalized.includes("warning") || normalized.includes("invalid")) return "WARN";
  return "INFO";
}

function fmtDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(value);
}

export default async function CrmEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  const action = typeof params.action === "string" ? params.action.trim() : "";
  const contactId = typeof params.contactId === "string" ? params.contactId.trim() : "";
  const conversationId = typeof params.conversationId === "string" ? params.conversationId.trim() : "";
  const severity = typeof params.severity === "string" ? params.severity.trim().toUpperCase() : "";

  const logs = await prisma.internalActionLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(contactId ? { contactId } : {}),
      ...(conversationId ? { conversationId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: {
      contact: { select: { name: true } },
    },
  });

  const filtered = logs
    .map(log => ({
      ...log,
      severity: inferSeverity(log.action),
    }))
    .filter(item => (severity ? item.severity === severity : true));

  const [recentSendFails, recentWebhookFails, stuckQueue] = await Promise.all([
    prisma.internalActionLog.findMany({
      where: { action: "WhatsAppSendFailed", createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    prisma.internalActionLog.findMany({
      where: { action: "WebhookProcessingFailed", createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    prisma.automationQueueJob.findMany({
      where: { status: "processing", startedAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) } },
      orderBy: { startedAt: "asc" },
      take: 1,
    }),
  ]);

  const alerts = [
    recentSendFails[0] ? { code: "EVOLUTION_OFFLINE", text: "Falhas recentes na Evolution API", level: "critical" } : null,
    recentWebhookFails[0] ? { code: "WEBHOOK_FAILING", text: "Falhas recentes no webhook", level: "critical" } : null,
    stuckQueue[0] ? { code: "QUEUE_STUCK", text: "Fila de automação possivelmente travada", level: "warning" } : null,
  ].filter(Boolean) as Array<{ code: string; text: string; level: "warning" | "critical" }>;

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">CRM Events</h1>
        <p className="text-sm text-slate-600">Últimos eventos com filtros por conversa, contato, ação e severidade.</p>
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Alertas operacionais</h2>
          {alerts.map(alert => (
            <p key={alert.code} className={alert.level === "critical" ? "text-sm text-red-700" : "text-sm text-amber-800"}>
              [{alert.code}] {alert.text}
            </p>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Sem alertas operacionais ativos.
        </div>
      )}

      <form className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4" method="GET">
        <input name="action" placeholder="Ação (ex: QuoteSent)" defaultValue={action} className="rounded border border-slate-300 px-3 py-2 text-sm" />
        <input name="contactId" placeholder="Contact ID" defaultValue={contactId} className="rounded border border-slate-300 px-3 py-2 text-sm" />
        <input name="conversationId" placeholder="Conversation ID" defaultValue={conversationId} className="rounded border border-slate-300 px-3 py-2 text-sm" />
        <select name="severity" defaultValue={severity} className="rounded border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todas severidades</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
          <option value="AUTOMATION">AUTOMATION</option>
          <option value="SECURITY">SECURITY</option>
        </select>
        <button type="submit" className="md:col-span-4 rounded bg-slate-900 px-3 py-2 text-sm text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Quando</th>
              <th className="px-3 py-2 text-left font-medium">Severidade</th>
              <th className="px-3 py-2 text-left font-medium">Ação</th>
              <th className="px-3 py-2 text-left font-medium">Contato</th>
              <th className="px-3 py-2 text-left font-medium">Conversa</th>
              <th className="px-3 py-2 text-left font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nenhum evento encontrado.</td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-2 align-top whitespace-nowrap">{fmtDate(item.createdAt)}</td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">{item.severity}</td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">{item.action}</td>
                  <td className="px-3 py-2 align-top">{item.contact?.name || item.contactId || "-"}</td>
                  <td className="px-3 py-2 align-top">{item.conversationId || "-"}</td>
                  <td className="px-3 py-2 align-top">
                    <pre className="max-w-[540px] overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">
                      {item.metadataJson || "{}"}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
