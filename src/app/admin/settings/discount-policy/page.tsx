'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, BadgePercent, CalendarOff, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import type { DiscountBlockedDateRange, DiscountPolicy } from '@/lib/discount-policy';

const EMPTY_POLICY: DiscountPolicy = {
    sendEnabled: true,
    percentage: 10,
    validityDays: 7,
    minimumBookingValue: null,
    maximumDiscountAmount: null,
    blockedDateRanges: [],
};

function newRange(): DiscountBlockedDateRange {
    return { start: '', end: '', label: '' };
}

export default function DiscountPolicySettingsPage() {
    const [policy, setPolicy] = useState<DiscountPolicy>(EMPTY_POLICY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        async function loadPolicy() {
            try {
                const response = await fetch('/api/admin/settings/discount-policy', { signal: controller.signal });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data?.error || 'Erro ao carregar a política.');
                setPolicy(data.policy);
            } catch (loadError) {
                if (!controller.signal.aborted) {
                    setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar a política.');
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void loadPolicy();
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

    async function savePolicy() {
        if (saving) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch('/api/admin/settings/discount-policy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(policy),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const firstError = data?.errors ? Object.values(data.errors)[0] : null;
                throw new Error(String(firstError || data?.error || 'Erro ao salvar a política.'));
            }
            setPolicy(data.policy);
            setSuccess('Política de desconto salva com sucesso.');
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar a política.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-700 p-2 text-white"><BadgePercent size={28} /></div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800">Política de desconto</h1>
                </div>
                <p className="font-medium text-slate-500">
                    Controle os cupons individuais enviados pelas reservas e impeça descontos em períodos concorridos.
                </p>
            </header>

            {error ? <div role="alert" className="flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 font-medium text-red-700"><AlertCircle />{error}</div> : null}
            {success ? <div role="status" className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 font-medium text-emerald-700"><CheckCircle2 />{success}</div> : null}

            {loading ? (
                <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
            ) : (
                <>
                    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <span>
                                <span className="block font-black text-slate-800">Permitir envio de novos descontos</span>
                                <span className="mt-1 block text-sm text-slate-500">
                                    Quando pausado, o botão do admin não gera nem envia novos cupons. Cupons já enviados continuam respeitando suas regras.
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                checked={policy.sendEnabled}
                                onChange={(event) => setPolicy((current) => ({ ...current, sendEnabled: event.target.checked }))}
                                className="mt-1 h-5 w-5 accent-violet-700"
                            />
                        </label>

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Desconto individual</span>
                                <div className="flex overflow-hidden rounded-xl border border-slate-200">
                                    <input type="number" min={1} max={50} value={policy.percentage} onChange={(event) => setPolicy((current) => ({ ...current, percentage: Number(event.target.value) }))} className="w-full px-4 py-3 font-bold outline-none" />
                                    <span className="bg-slate-100 px-4 py-3 font-bold text-slate-500">%</span>
                                </div>
                            </label>
                            <label className="space-y-2">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Validade do cupom</span>
                                <div className="flex overflow-hidden rounded-xl border border-slate-200">
                                    <input type="number" min={1} max={365} value={policy.validityDays} onChange={(event) => setPolicy((current) => ({ ...current, validityDays: Number(event.target.value) }))} className="w-full px-4 py-3 font-bold outline-none" />
                                    <span className="bg-slate-100 px-4 py-3 font-bold text-slate-500">dias</span>
                                </div>
                            </label>
                        </div>

                        <details className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-600">
                                Limites avançados
                            </summary>
                            <div className="grid gap-4 border-t border-slate-200 p-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Valor mínimo da reserva</span>
                                    <input type="number" min={0} step="0.01" value={policy.minimumBookingValue ?? ''} onChange={(event) => setPolicy((current) => ({ ...current, minimumBookingValue: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="Sem mínimo" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none" />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Desconto máximo em reais</span>
                                    <input type="number" min={0} step="0.01" value={policy.maximumDiscountAmount ?? ''} onChange={(event) => setPolicy((current) => ({ ...current, maximumDiscountAmount: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="Sem limite" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none" />
                                </label>
                            </div>
                        </details>
                    </section>

                    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="flex items-center gap-2 text-xl font-black text-slate-800"><CalendarOff className="text-violet-700" />Datas sem desconto</h2>
                                <p className="mt-1 text-sm text-slate-500">Se qualquer noite da hospedagem cair no período, o cupom será recusado.</p>
                            </div>
                            <button type="button" onClick={() => setPolicy((current) => ({ ...current, blockedDateRanges: [...current.blockedDateRanges, newRange()] }))} className="flex items-center justify-center gap-2 rounded-xl bg-violet-50 px-4 py-2 font-bold text-violet-700 hover:bg-violet-100">
                                <Plus size={18} />Adicionar período
                            </button>
                        </div>

                        {policy.blockedDateRanges.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-medium text-slate-400">Nenhum período bloqueado.</div>
                        ) : policy.blockedDateRanges.map((range, index) => (
                            <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_1.4fr_auto]">
                                <label className="space-y-1 text-xs font-bold text-slate-500">Início<input aria-label={`Início do período ${index + 1}`} type="date" value={range.start} onChange={(event) => updateRange(index, 'start', event.target.value)} className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800" /></label>
                                <label className="space-y-1 text-xs font-bold text-slate-500">Fim<input aria-label={`Fim do período ${index + 1}`} type="date" value={range.end} min={range.start || undefined} onChange={(event) => updateRange(index, 'end', event.target.value)} className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800" /></label>
                                <label className="space-y-1 text-xs font-bold text-slate-500">Motivo<input aria-label={`Motivo do período ${index + 1}`} type="text" value={range.label} maxLength={80} onChange={(event) => updateRange(index, 'label', event.target.value)} placeholder="Ex.: Réveillon" className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800" /></label>
                                <button type="button" aria-label={`Remover período ${index + 1}`} onClick={() => setPolicy((current) => ({ ...current, blockedDateRanges: current.blockedDateRanges.filter((_, rangeIndex) => rangeIndex !== index) }))} className="self-end rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={19} /></button>
                            </div>
                        ))}
                    </section>

                    <div className="flex justify-end">
                        <button type="button" onClick={() => void savePolicy()} disabled={saving} className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-black text-white disabled:opacity-50">
                            <Save size={19} />{saving ? 'Salvando...' : 'Salvar política'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
