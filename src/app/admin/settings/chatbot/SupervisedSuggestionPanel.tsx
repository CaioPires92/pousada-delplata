"use client";

import Link from "next/link";
import { ExternalLink, RefreshCw, UserCheck } from "lucide-react";
import { useState } from "react";

type Suggestion = {
  id: string;
  conversationId: string;
  contactLabel: string;
  content: string;
  intent: string;
  createdAt: string;
};

export function SupervisedSuggestionPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSuggestions() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/chatbot/suggestions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.suggestions)) throw new Error("invalid_response");
      setSuggestions(data.suggestions);
      setLoaded(true);
    } catch {
      setError("Não foi possível carregar a fila supervisionada.");
    } finally {
      setLoading(false);
    }
  }

  async function dismissSuggestion(suggestionId: string) {
    const response = await fetch("/api/admin/chatbot/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestionId }),
    });
    if (response.ok) setSuggestions(current => current.filter(item => item.id !== suggestionId));
    else setError("Não foi possível descartar a sugestão.");
  }

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6">
        <span className="flex items-start gap-3">
          <span className="rounded-xl bg-sky-100 p-2 text-sky-700"><UserCheck size={22} /></span>
          <span>
            <span className="block font-black text-slate-800">Fila supervisionada</span>
            <span className="mt-1 block text-sm font-medium text-slate-500">Sugestões aguardando revisão humana. Nada é enviado por este painel.</span>
          </span>
        </span>
        <span className="text-xs font-black uppercase tracking-wider text-slate-400 group-open:hidden">Abrir</span>
        <span className="hidden text-xs font-black uppercase tracking-wider text-slate-400 group-open:inline">Fechar</span>
      </summary>
      <div className="border-t border-slate-100 p-6">
        <button type="button" onClick={loadSuggestions} disabled={loading} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Carregando..." : loaded ? "Atualizar fila" : "Carregar fila"}
        </button>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {loaded && suggestions.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-medium text-slate-500">Nenhuma sugestão pendente.</p>}
        <div className="space-y-3">
          {suggestions.map(suggestion => (
            <article key={suggestion.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">{suggestion.contactLabel}</p>
                  <p className="mt-1 text-xs font-bold uppercase text-sky-700">{suggestion.intent} · {new Date(suggestion.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <Link href={`/admin/inbox/${suggestion.conversationId}`} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Revisar na conversa <ExternalLink size={12} /></Link>
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{suggestion.content}</p>
              <button type="button" onClick={() => dismissSuggestion(suggestion.id)} className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Descartar sem enviar</button>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}
