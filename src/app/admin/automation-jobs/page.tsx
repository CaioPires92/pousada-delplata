export default function AutomationJobsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Atendimento e CRM</p>
        <h1 className="mt-1 text-2xl font-black text-slate-800">Fila de Automação</h1>
        <p className="mt-1 text-sm text-slate-500">
          Esta tela fica disponível no painel, mas a fila pode variar conforme a base local e as migrações aplicadas.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          A fila de automação é processada em segundo plano. Quando houver jobs ativos, eles aparecem aqui na interface do painel.
        </p>
      </section>
    </div>
  );
}
