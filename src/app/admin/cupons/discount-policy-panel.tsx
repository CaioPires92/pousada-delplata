'use client';

import { useEffect, useState } from 'react';
import { CalendarOff, ChevronDown, Plus, Save, Trash2, X } from 'lucide-react';
import type { DiscountBlockedDateRange, DiscountPolicy } from '@/lib/discount-policy';

const DEFAULT_POLICY: DiscountPolicy = {
    sendEnabled: true,
    percentage: 10,
    validityDays: 7,
    minimumBookingValue: null,
    maximumDiscountAmount: null,
    blockedDateRanges: [],
};

export default function DiscountPolicyPanel() {
    const [policy, setPolicy] = useState<DiscountPolicy>(DEFAULT_POLICY);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const response = await fetch('/api/admin/settings/discount-policy', { signal: controller.signal });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar.');
                setPolicy(data.policy);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setMessage(error instanceof Error ? error.message : 'Não foi possível carregar.');
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, []);

    function updateRange(index: number, field: keyof DiscountBlockedDateRange, value: string) {
        setPolicy((current) => ({
            ...current,
            blockedDateRanges: current.blockedDateRanges.map((range, rangeIndex) => (
                rangeIndex === index ? { ...range, [field]: value } : range
            )),
        }));
    }

    async function save() {
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch('/api/admin/settings/discount-policy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(policy),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const firstError = data?.errors ? Object.values(data.errors)[0] : null;
                throw new Error(String(firstError || data?.error || 'Não foi possível salvar.'));
            }
            setPolicy(data.policy);
            setEditing(false);
            setMessage('Política salva.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="mb-6 h-20 animate-pulse rounded-2xl bg-slate-100" />;
    }

    return (
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-800">Desconto enviado ao hóspede</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${policy.sendEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {policy.sendEnabled ? 'Envio ativo' : 'Envio pausado'}
                        </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        {policy.percentage}% · válido por {policy.validityDays} dias · 1 uso por hóspede
                        {policy.blockedDateRanges.length > 0 ? ` · ${policy.blockedDateRanges.length} período(s) sem desconto` : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setEditing((current) => !current);
                        setMessage(null);
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                    {editing ? <X size={17} /> : <ChevronDown size={17} />}
                    {editing ? 'Fechar' : 'Alterar'}
                </button>
            </div>

            {message ? (
                <p role="status" className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-600">
                    {message}
                </p>
            ) : null}

            {editing ? (
                <div className="space-y-5 border-t border-slate-200 bg-slate-50/70 p-5">
                    <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                        <span>
                            <span className="block font-bold text-slate-800">Permitir novos envios</span>
                            <span className="text-xs text-slate-500">Pausar não cancela cupons já enviados.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={policy.sendEnabled}
                            onChange={(event) => setPolicy((current) => ({ ...current, sendEnabled: event.target.checked }))}
                            className="h-5 w-5 accent-violet-700"
                        />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1 text-sm font-bold text-slate-700">
                            Desconto
                            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <input type="number" min={1} max={50} value={policy.percentage} onChange={(event) => setPolicy((current) => ({ ...current, percentage: Number(event.target.value) }))} className="w-full px-4 py-3 outline-none" />
                                <span className="bg-slate-100 px-4 py-3">%</span>
                            </div>
                        </label>
                        <label className="space-y-1 text-sm font-bold text-slate-700">
                            Validade
                            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <input type="number" min={1} max={365} value={policy.validityDays} onChange={(event) => setPolicy((current) => ({ ...current, validityDays: Number(event.target.value) }))} className="w-full px-4 py-3 outline-none" />
                                <span className="bg-slate-100 px-4 py-3">dias</span>
                            </div>
                        </label>
                    </div>

                    <details className="rounded-xl border border-slate-200 bg-white">
                        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-600">Limites opcionais</summary>
                        <div className="grid gap-4 border-t border-slate-200 p-4 sm:grid-cols-2">
                            <label className="space-y-1 text-sm font-bold text-slate-700">
                                Valor mínimo da reserva
                                <input type="number" min={0} step="0.01" value={policy.minimumBookingValue ?? ''} onChange={(event) => setPolicy((current) => ({ ...current, minimumBookingValue: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="Sem mínimo" className="block w-full rounded-xl border border-slate-200 px-4 py-3 outline-none" />
                            </label>
                            <label className="space-y-1 text-sm font-bold text-slate-700">
                                Desconto máximo em reais
                                <input type="number" min={0} step="0.01" value={policy.maximumDiscountAmount ?? ''} onChange={(event) => setPolicy((current) => ({ ...current, maximumDiscountAmount: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="Sem limite" className="block w-full rounded-xl border border-slate-200 px-4 py-3 outline-none" />
                            </label>
                        </div>
                    </details>

                    <div className="space-y-3">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <h4 className="flex items-center gap-2 font-black text-slate-800"><CalendarOff size={18} />Datas sem desconto</h4>
                                <p className="text-xs text-slate-500">O cupom não funciona se a hospedagem passar por uma destas datas.</p>
                            </div>
                            <button type="button" onClick={() => setPolicy((current) => ({ ...current, blockedDateRanges: [...current.blockedDateRanges, { start: '', end: '', label: '' }] }))} className="flex items-center justify-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">
                                <Plus size={16} />Adicionar
                            </button>
                        </div>
                        {policy.blockedDateRanges.map((range, index) => (
                            <div key={index} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_1.3fr_auto]">
                                <input aria-label={`Início do período ${index + 1}`} type="date" value={range.start} onChange={(event) => updateRange(index, 'start', event.target.value)} className="rounded-lg border border-slate-200 p-2 text-sm" />
                                <input aria-label={`Fim do período ${index + 1}`} type="date" min={range.start || undefined} value={range.end} onChange={(event) => updateRange(index, 'end', event.target.value)} className="rounded-lg border border-slate-200 p-2 text-sm" />
                                <input aria-label={`Nome do período ${index + 1}`} value={range.label} onChange={(event) => updateRange(index, 'label', event.target.value)} placeholder="Ex.: Réveillon" className="rounded-lg border border-slate-200 p-2 text-sm" />
                                <button type="button" aria-label={`Remover período ${index + 1}`} onClick={() => setPolicy((current) => ({ ...current, blockedDateRanges: current.blockedDateRanges.filter((_, rangeIndex) => rangeIndex !== index) }))} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end">
                        <button type="button" onClick={() => void save()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">
                            <Save size={18} />{saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
