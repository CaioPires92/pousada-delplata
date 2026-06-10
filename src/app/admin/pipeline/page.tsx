"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Phone, Plus, X, Calendar, DollarSign, AlertCircle, RefreshCcw } from "lucide-react";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_ORDER, PIPELINE_STAGES } from "@/lib/crm/pipelineStages";
import { formatDateBR } from "@/lib/date";

type PipelineCard = {
    id: string;
    stage: string;
    priority: string;
    source: string;
    assignedUserId: string | null;
    lastActivityAt: string | null;
    createdAt: string;
    updatedAt: string;
    estimatedValue: number | null;
    intendedArrival: string | null;
    lossReason: string | null;
    contact: {
        id: string;
        name: string;
        phone: string | null;
    };
    conversation: {
        id: string;
        status: string;
        channel: string;
        lastMessageAt: string | null;
        lastMessage: string | null;
    } | null;
};

type PipelineStage = {
    stage: string;
    cards: PipelineCard[];
};

type PipelineResponse = {
    ok: boolean;
    stages: PipelineStage[];
};

const LOSS_REASONS = [
    "Preço alto",
    "Sem disponibilidade",
    "Não respondeu",
    "Desistiu da viagem",
    "Fechou com concorrente",
    "Outro"
];

function formatStageLabel(stage: string): string {
    return PIPELINE_STAGE_LABELS[stage as keyof typeof PIPELINE_STAGE_LABELS] ?? stage.replace(/_/g, " ");
}

function formatCurrency(value: number | null): string {
    if (value === null) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const STAGE_OPTIONS = PIPELINE_STAGE_ORDER;

export default function AdminPipelinePage() {
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [movingCardId, setMovingCardId] = useState<string | null>(null);
    const [filterPriority, setFilterPriority] = useState<string>("all");
    const [filterSource, setFilterSource] = useState<string>("all");

    // Modal de Novo Lead
    const [showNewLeadModal, setShowNewLeadModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "", phone: "", email: "", estimatedValue: "", intendedArrival: ""
    });

    // Modal de Perda
    const [showLossModal, setShowLossModal] = useState(false);
    const [cardToLose, setCardToLose] = useState<string | null>(null);
    const [lossReason, setLossReason] = useState("");

    const loadPipeline = useCallback(async (options?: { keepLoadingState?: boolean }) => {
        try {
            setError(null);
            if (!options?.keepLoadingState) setLoading(true);
            const response = await fetch("/api/crm/pipeline", { cache: "no-store" });
            if (!response.ok) throw new Error("Falha ao conectar com o servidor.");
            const data = await response.json() as PipelineResponse;
            if (!data.ok) throw new Error("Erro ao processar dados do pipeline.");
            setStages(Array.isArray(data.stages) ? data.stages : []);
        } catch (err: any) {
            console.error("Erro ao carregar pipeline:", err);
            setError(err.message || "Erro desconhecido ao carregar o pipeline.");
            setStages([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadPipeline();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadPipeline]);

    async function handleStageChange(cardId: string, nextStage: string, reason?: string) {
        if (nextStage === PIPELINE_STAGES.PERDIDO && !reason) {
            setCardToLose(cardId);
            setShowLossModal(true);
            return;
        }

        setMovingCardId(cardId);
        setError(null);
        try {
            const response = await fetch(`/api/crm/pipeline/cards/${cardId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stage: nextStage, reason: reason || null, lossReason: reason || null }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.error || "Erro ao mover card.");
            await loadPipeline({ keepLoadingState: true });
        } catch (err: any) {
            console.error("Erro ao mover card:", err);
            setError(err.message || "Erro ao atualizar estágio do card.");
        } finally {
            setMovingCardId(null);
        }
    }

    async function handleConfirmLoss() {
        if (!cardToLose || !lossReason) return;
        setIsSaving(true);
        try {
            await handleStageChange(cardToLose, PIPELINE_STAGES.PERDIDO, lossReason);
            setShowLossModal(false);
            setCardToLose(null);
            setLossReason("");
        } catch {
        } finally {
            setIsSaving(false);
        }
    }

    async function handleCreateLead(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/crm/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            if (data.ok) {
                setShowNewLeadModal(false);
                setFormData({ name: "", phone: "", email: "", estimatedValue: "", intendedArrival: "" });
                if (data.message) alert(data.message); // Alerta sobre card já existente
                await loadPipeline({ keepLoadingState: true });
            } else {
                throw new Error(data.error || "Erro ao criar lead.");
            }
        } catch (err: any) {
            alert(err.message || "Erro de conexão ao criar lead.");
        } finally {
            setIsSaving(false);
        }
    }

    const totalCards = useMemo(() => stages.reduce((total, stage) => total + stage.cards.length, 0), [stages]);

    const filteredStages = useMemo(() => {
        return stages.map(stage => ({
            ...stage,
            cards: stage.cards.filter(card => {
                const matchPriority = filterPriority === "all" || card.priority === filterPriority;
                const matchSource = filterSource === "all" || card.source === filterSource;
                return matchPriority && matchSource;
            })
        }));
    }, [stages, filterPriority, filterSource]);

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">CRM Delplata</p>
                    <h1 className="mt-1 text-2xl font-black text-slate-950 tracking-tight">Vendas & Kanban</h1>
                    <p className="text-sm text-slate-500 font-medium">Gestão comercial dos leads de WhatsApp.</p>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => loadPipeline()}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 transition-all"
                        title="Recarregar"
                    >
                        <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                    <div className="hidden sm:block rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600 italic">
                        {totalCards} CARDS
                    </div>
                    <button
                        onClick={() => setShowNewLeadModal(true)}
                        className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all uppercase tracking-wider"
                    >
                        <Plus className="h-5 w-5" />
                        Novo Lead
                    </button>
                </div>
            </header>

            <div className="flex flex-wrap gap-4 items-center bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Prioridade:</span>
                    <select 
                        value={filterPriority} 
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 outline-none"
                    >
                        <option value="all">Todas</option>
                        <option value="high">Alta</option>
                        <option value="normal">Normal</option>
                        <option value="low">Baixa</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Origem:</span>
                    <select 
                        value={filterSource} 
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 outline-none"
                    >
                        <option value="all">Todas</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="manual">Manual</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 flex items-center justify-between text-sm font-black text-red-700 uppercase tracking-widest">
                    <div className="flex items-center gap-3">
                        <AlertCircle />
                        {error}
                    </div>
                    <button onClick={() => setError(null)} className="text-[10px] underline">FECHAR</button>
                </div>
            )}

            {loading ? (
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-3 text-emerald-600" />
                    <span className="font-bold">Sincronizando pipeline...</span>
                </div>
            ) : (
                <section className="grid gap-4 xl:grid-cols-5 h-full items-start pb-10">
                    {filteredStages.map((stage) => (
                        <div key={stage.stage} className="flex flex-col min-h-[500px] rounded-3xl border border-slate-200 bg-slate-50/50 backdrop-blur-sm">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60">
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 italic">{formatStageLabel(stage.stage)}</h2>
                                <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-black text-slate-400 border border-slate-200">{stage.cards.length}</span>
                            </div>

                            <div className="flex-1 space-y-4 p-4 overflow-y-auto max-h-[70vh]">
                                {stage.cards.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-4 py-10 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Vazio</div>
                                ) : (
                                    stage.cards.map((card) => (
                                        <article 
                                            key={card.id} 
                                            className={`group rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-default relative overflow-hidden ${
                                                card.priority === 'high' ? 'border-red-200 border-l-4 border-l-red-500' : 
                                                card.priority === 'low' ? 'border-slate-200 opacity-80' : 
                                                'border-slate-200 hover:border-emerald-200'
                                            }`}
                                        >
                                            {card.stage === PIPELINE_STAGES.RESERVA_CONFIRMADA && <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500 rotate-45 translate-x-6 -translate-y-6" />}
                                            
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-base font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">{card.contact.name}</h3>
                                                    <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                                        <Phone className="h-3.5 w-3.5" />
                                                        {card.contact.phone ?? "Sem telefone"}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {card.estimatedValue !== null && (
                                                    <span className="flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100">
                                                        <DollarSign size={10} />
                                                        {formatCurrency(card.estimatedValue)}
                                                    </span>
                                                )}
                                                {card.intendedArrival && (
                                                    <span className="flex items-center gap-1 text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-1 rounded-lg border border-slate-200">
                                                        <Calendar size={10} />
                                                        {formatDateBR(card.intendedArrival)}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-5 space-y-3">
                                                <label className="block">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mudar Estágio</span>
                                                    <select
                                                        value={card.stage}
                                                        disabled={movingCardId === card.id}
                                                        onChange={(e) => handleStageChange(card.id, e.target.value)}
                                                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 outline-none transition-all hover:border-emerald-300 focus:ring-2 focus:ring-emerald-500 appearance-none disabled:opacity-50"
                                                    >
                                                        {STAGE_OPTIONS.map((opt) => <option key={opt} value={opt}>{formatStageLabel(opt)}</option>)}
                                                    </select>
                                                </label>

                                                {card.conversation && (
                                                    <Link
                                                        href={`/admin/inbox/${card.conversation.id}`}
                                                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-3 py-2.5 text-xs font-black text-slate-900 uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                                    >
                                                        Abrir Chat <ArrowRight className="h-4 w-4" />
                                                    </Link>
                                                )}
                                            </div>
                                        </article>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {/* Modal Novo Lead */}
            {showNewLeadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-lg rounded-[2.5rem] bg-white p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Novo Lead</h2>
                                <p className="text-slate-500 font-bold text-sm">Cadastre uma oportunidade manual.</p>
                            </div>
                            <button onClick={() => setShowNewLeadModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateLead} className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nome Completo</label>
                                <input
                                    required
                                    disabled={isSaving}
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:border-emerald-500 focus:bg-white outline-none font-bold transition-all disabled:opacity-50"
                                    placeholder="João da Silva"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">WhatsApp</label>
                                    <input
                                        disabled={isSaving}
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:border-emerald-500 focus:bg-white outline-none font-bold transition-all disabled:opacity-50"
                                        placeholder="55..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Valor (R$)</label>
                                    <input
                                        disabled={isSaving}
                                        type="number"
                                        value={formData.estimatedValue}
                                        onChange={e => setFormData({ ...formData, estimatedValue: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:border-emerald-500 focus:bg-white outline-none font-bold transition-all disabled:opacity-50"
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Previsão de Chegada</label>
                                <input
                                    disabled={isSaving}
                                    type="date"
                                    value={formData.intendedArrival}
                                    onChange={e => setFormData({ ...formData, intendedArrival: e.target.value })}
                                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:border-emerald-500 focus:bg-white outline-none font-bold transition-all disabled:opacity-50"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 disabled:opacity-50 mt-4"
                            >
                                {isSaving ? "PROCESSANDO..." : "CRIAR LEAD AGORA"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Perda */}
            {showLossModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-md rounded-[2.5rem] bg-white p-10 shadow-2xl animate-in zoom-in-95 duration-300 border-t-8 border-red-500">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                                    <AlertCircle className="text-red-500" />
                                    Lead Perdido
                                </h2>
                                <p className="text-slate-500 font-bold text-sm">Por que não fechamos negócio?</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {LOSS_REASONS.map((reason) => (
                                <button
                                    key={reason}
                                    onClick={() => setLossReason(reason)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left font-black text-sm transition-all ${lossReason === reason ? 'border-red-500 bg-red-50 text-red-700 shadow-md' : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>

                        <div className="mt-8 flex gap-4">
                            <button
                                onClick={() => { setShowLossModal(false); setCardToLose(null); }}
                                className="flex-1 py-4 rounded-2xl font-black text-sm text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmLoss}
                                disabled={!lossReason || isSaving}
                                className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black text-sm hover:bg-red-600 transition-all shadow-xl shadow-red-100 disabled:opacity-50 uppercase tracking-widest"
                            >
                                {isSaving ? "Salvando..." : "Confirmar Perda"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
