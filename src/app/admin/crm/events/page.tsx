import prisma from "@/lib/prisma";
import {
  describeCrmEventAudit,
  formatCrmEventDate,
  parseCrmEventMetadata,
} from "@/lib/crm/eventHistory";
import { getOperationalAlerts } from "@/lib/crm/operationalAlerts";

type Severity = "INFO" | "WARN" | "ERROR" | "AUTOMATION" | "SECURITY";

function inferSeverity(action: string): Severity {
  const normalized = action.toLowerCase();
  if (normalized.includes("unauthorized") || normalized.includes("security")) return "SECURITY";
  if (normalized.includes("error") || normalized.includes("failed") || normalized.includes("failure")) return "ERROR";
  if (normalized.includes("debounced") || normalized.includes("timedout") || normalized.includes("prompt") || normalized.includes("quote")) return "AUTOMATION";
  if (normalized.includes("warning") || normalized.includes("invalid")) return "WARN";
  return "INFO";
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
    .map(log => {
      const metadata = parseCrmEventMetadata(log.metadataJson);
      return {
        ...log,
        metadata,
        audit: describeCrmEventAudit(metadata),
        severity: inferSeverity(log.action),
      };
    })
    .filter(item => (severity ? item.severity === severity : true));

  const alerts = await getOperationalAlerts(now);

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Histórico do CRM</h1>
        <p className="text-sm text-slate-600">Ações registradas com responsável, origem, motivo e horário.</p>
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Alertas operacionais</h2>
          {alerts.map(alert => (
            <p key={alert.code} className={alert.severity === "critical" ? "text-sm text-red-700" : "text-sm text-amber-800"}>
              [{alert.code}] {alert.title}{alert.count ? ` (${alert.count})` : ""}
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
              <th className="px-3 py-2 text-left font-medium">Data e horário</th>
              <th className="px-3 py-2 text-left font-medium">Severidade</th>
              <th className="px-3 py-2 text-left font-medium">Ação</th>
              <th className="px-3 py-2 text-left font-medium">Responsável</th>
              <th className="px-3 py-2 text-left font-medium">Motivo</th>
              <th className="px-3 py-2 text-left font-medium">Contato</th>
              <th className="px-3 py-2 text-left font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Nenhum evento encontrado.</td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-3 align-top whitespace-nowrap">{formatCrmEventDate(item.createdAt)}</td>
                  <td className="px-3 py-3 align-top whitespace-nowrap">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{item.severity}</span>
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">{item.action}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-slate-800">{item.audit.actorLabel}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.audit.originLabel}</div>
                  </td>
                  <td className="max-w-[320px] px-3 py-3 align-top text-slate-700">
                    {item.audit.reason || <span className="text-slate-400">Não informado</span>}
                  </td>
                  <td className="px-3 py-2 align-top">{item.contact?.name || item.contactId || "-"}</td>
                  <td className="px-3 py-3 align-top">
                    <details className="max-w-[460px] text-xs text-slate-600">
                      <summary className="cursor-pointer select-none font-medium text-slate-700">Detalhes técnicos</summary>
                      <div className="mt-2 space-y-1 rounded bg-slate-50 p-2">
                        <div><span className="font-medium">Conversa:</span> {item.conversationId || "-"}</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-600">
                          {JSON.stringify(item.metadata ?? {}, null, 2)}
                        </pre>
                      </div>
                    </details>
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
