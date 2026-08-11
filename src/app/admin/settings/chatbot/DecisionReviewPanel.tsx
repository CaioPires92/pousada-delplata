"use client";

import Link from "next/link";
import { ExternalLink, RefreshCw, ScanSearch } from "lucide-react";
import { useState } from "react";

type DecisionReview = {
  id: string;
  createdAt: string;
  conversationId: string | null;
  contactLabel: string;
  intent: string;
  heuristicIntent: string | null;
  confidence: number | null;
  source: string;
  mode: string;
  accepted: boolean;
  actionAuthorized: boolean;
  agreementWithHeuristic: boolean | null;
  suggestedAction: string | null;
  reasonCode: string | null;
  model: string | null;
  result: string | null;
  latencyMs: number | null;
  totalTokens: number | null;
};

type DailyReviewSummary = {
  sampled: number;
  shadow: number;
  authorizedActions: number;
  agreementRate: number | null;
  gatePassed: boolean;
};

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function DecisionReviewPanel() {
  const [decisions, setDecisions] = useState<DecisionReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewDay, setReviewDay] = useState<string | null>(null);
  const [summary, setSummary] = useState<DailyReviewSummary | null>(null);

  async function loadDecisions() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/chatbot/decisions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.decisions)) {
        throw new Error("invalid_response");
      }
      setDecisions(data.decisions);
      setReviewDay(typeof data.reviewDay === "string" ? data.reviewDay : null);
      setSummary(data.summary ?? null);
      setLoaded(true);
    } catch {
      setError("Não foi possível carregar as decisões recentes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6">
        <span className="flex items-start gap-3">
          <span className="rounded-xl bg-violet-100 p-2 text-violet-700">
            <ScanSearch size={22} />
          </span>
          <span>
            <span className="block font-black text-slate-800">Revisão das decisões</span>
            <span className="mt-1 block text-sm font-medium text-slate-500">
              Diagnóstico das 25 classificações mais recentes. Nenhuma ação da IA em shadow mode é executada.
            </span>
          </span>
        </span>
        <span className="text-xs font-black uppercase tracking-wider text-slate-400 group-open:hidden">Abrir</span>
        <span className="hidden text-xs font-black uppercase tracking-wider text-slate-400 group-open:inline">Fechar</span>
      </summary>

      <div className="border-t border-slate-100 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Use esta amostra para encontrar divergências antes de liberar qualquer intenção.</p>
          <button
            type="button"
            onClick={loadDecisions}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-900 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {loading ? "Carregando..." : loaded ? "Atualizar amostra" : "Carregar amostra"}
          </button>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

        {loaded && summary && (
          <div className={`mb-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-4 ${summary.gatePassed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div><span className="block text-xs font-bold uppercase text-slate-500">Dia UTC</span><strong>{reviewDay ?? "—"}</strong></div>
            <div><span className="block text-xs font-bold uppercase text-slate-500">Amostra</span><strong>{summary.sampled}</strong></div>
            <div><span className="block text-xs font-bold uppercase text-slate-500">Concordância</span><strong>{percent(summary.agreementRate)}</strong></div>
            <div><span className="block text-xs font-bold uppercase text-slate-500">Gate shadow</span><strong>{summary.gatePassed ? "Aprovado" : "Pendente"}</strong></div>
            {summary.authorizedActions > 0 && (
              <p className="sm:col-span-4 text-sm font-bold text-red-700">Bloqueio: houve ação autorizada durante shadow mode.</p>
            )}
          </div>
        )}

        {loaded && decisions.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-medium text-slate-500">
            Ainda não há classificações registradas.
          </p>
        )}

        {decisions.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Conversa</th>
                  <th className="px-4 py-3">Decisão</th>
                  <th className="px-4 py-3">Confiança</th>
                  <th className="px-4 py-3">Comparação</th>
                  <th className="px-4 py-3">Execução</th>
                  <th className="px-4 py-3">Desempenho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decisions.map(decision => (
                  <tr key={decision.id} className="align-top text-slate-700">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{decision.contactLabel}</div>
                      <div className="mt-1 text-xs text-slate-400">{new Date(decision.createdAt).toLocaleString("pt-BR")}</div>
                      {decision.conversationId && (
                        <Link
                          href={`/admin/inbox/${decision.conversationId}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                        >
                          Abrir conversa <ExternalLink size={12} />
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">{decision.intent}</span>
                      <div className="mt-2 text-xs text-slate-500">{decision.source} · {decision.mode}</div>
                      {decision.suggestedAction && <div className="mt-1 text-xs text-slate-400">Sugestão: {decision.suggestedAction}</div>}
                    </td>
                    <td className="px-4 py-3 font-black text-slate-800">{percent(decision.confidence)}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs">Heurística: <strong>{decision.heuristicIntent ?? "—"}</strong></div>
                      {decision.agreementWithHeuristic !== null && (
                        <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${decision.agreementWithHeuristic ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                          {decision.agreementWithHeuristic ? "Concordou" : "Divergiu"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${decision.actionAuthorized ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                        {decision.actionAuthorized ? "Autorizada" : "Não autorizada"}
                      </span>
                      <div className="mt-2 text-xs text-slate-400">{decision.result ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>{decision.latencyMs === null ? "—" : `${decision.latencyMs} ms`}</div>
                      <div className="mt-1">{decision.totalTokens === null ? "Sem tokens" : `${decision.totalTokens} tokens`}</div>
                      {decision.model && <div className="mt-1 max-w-40 truncate" title={decision.model}>{decision.model}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
