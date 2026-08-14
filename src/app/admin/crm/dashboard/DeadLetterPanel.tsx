"use client";

import { useEffect, useState } from "react";

type Item = { id: string; source: string; action: string; reason: string; status: string; createdAt: string };

export function DeadLetterPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/crm/dead-letter?status=open");
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) setError("Não foi possível carregar a dead-letter.");
      else { setItems(data.items); setError(""); }
    } catch {
      setError("Não foi possível carregar a dead-letter.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function dismiss(item: Item) {
    const reason = window.prompt("Motivo do descarte (nenhuma mensagem será enviada):");
    if (!reason?.trim()) return;
    if (!window.confirm("Confirmar descarte sem reenviar esta mensagem?")) return;
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/crm/dead-letter/${item.id}/dismiss`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) setError("Não foi possível descartar o item.");
      else setItems(current => current.filter(candidate => candidate.id !== item.id));
    } catch {
      setError("Não foi possível descartar o item.");
    } finally {
      setBusyId("");
    }
  }

  async function replay(item: Item) {
    const confirmation = window.prompt(
      "Esta ação pode enviar uma mensagem real ao hóspede. Digite REPROCESSAR para confirmar:",
    );
    if (confirmation !== "REPROCESSAR") return;

    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/crm/dead-letter/${item.id}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) setError("Não foi possível reprocessar o item.");
      else setItems(current => current.filter(candidate => candidate.id !== item.id));
    } catch {
      setError("Não foi possível reprocessar o item.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dead-letter aberta</h2><button onClick={() => void load()} className="text-xs font-semibold text-slate-600">Atualizar</button></div>
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      {loading ? <p className="text-sm text-slate-500">Carregando...</p> : items.length === 0 ? <p className="text-sm text-emerald-700">Nenhum item aguardando recuperação.</p> : (
        <div className="space-y-2">{items.map(item => <div key={item.id} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><div className="flex justify-between gap-3"><div><p className="font-semibold text-amber-950">{item.action}</p><p className="text-xs text-amber-800">{item.reason}</p><p className="mt-1 text-xs text-slate-500">{item.source} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p></div><div className="flex h-fit gap-2"><button disabled={busyId === item.id} onClick={() => void replay(item)} className="rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === item.id ? "Processando..." : "Reprocessar"}</button><button disabled={busyId === item.id} onClick={() => void dismiss(item)} className="rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Descartar sem enviar</button></div></div></div>)}</div>
      )}
    </section>
  );
}
