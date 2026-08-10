import Link from "next/link";

import prisma from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  failed: "Falhou",
};

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function journeyLabel(value: string | null) {
  return value?.replaceAll("_", " ") ?? "sistema";
}

export default async function AutomationJobsPage() {
  const [pendingCount, failedCount, jobs] = await Promise.all([
    prisma.automationQueueJob.count({ where: { status: "pending" } }),
    prisma.automationQueueJob.count({ where: { status: "failed" } }),
    prisma.automationQueueJob.findMany({
      where: { status: { in: ["pending", "failed"] } },
      orderBy: [{ status: "desc" }, { scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        conversation: {
          select: {
            id: true,
            contact: { select: { name: true, phone: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Atendimento e CRM</p>
        <h1 className="mt-1 text-2xl font-black text-slate-800">Fila de Automação</h1>
        <p className="mt-1 text-sm text-slate-500">Acompanhe os próximos envios e os trabalhos que precisam de atenção.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-sky-700">Pendentes</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
          <p className="text-xs font-black uppercase tracking-wide text-rose-700">Falhos</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{failedCount}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-slate-800">Últimos jobs pendentes e falhos</h2>
          <p className="text-xs text-slate-500">Exibindo até 100 registros.</p>
        </div>
        {jobs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nenhum job pendente ou falho.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3">Jornada</th>
                  <th className="px-5 py-3">Agendado</th>
                  <th className="px-5 py-3">Tentativas</th>
                  <th className="px-5 py-3">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map(job => (
                  <tr key={job.id} className="text-slate-700">
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${job.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>
                        {STATUS_LABELS[job.status] ?? job.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Link className="font-bold text-slate-800 hover:text-emerald-700" href={`/admin/inbox/${job.conversation.id}`}>
                        {job.conversation.contact.name || job.conversation.contact.phone || "Contato sem nome"}
                      </Link>
                    </td>
                    <td className="px-5 py-4 capitalize">{journeyLabel(job.journeyType)}</td>
                    <td className="whitespace-nowrap px-5 py-4">{formatDate(job.scheduledAt ?? job.createdAt)}</td>
                    <td className="px-5 py-4">{job.attempts}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-slate-500" title={job.lastError ?? job.action}>
                      {job.lastError ?? job.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
