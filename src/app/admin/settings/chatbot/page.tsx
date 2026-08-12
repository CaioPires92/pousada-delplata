"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, MessageSquare, Bot, AlertCircle, CheckCircle2, Pencil, X, Power, Columns3, ShieldCheck } from "lucide-react";
import { DecisionReviewPanel } from "./DecisionReviewPanel";
import { SupervisedSuggestionPanel } from "./SupervisedSuggestionPanel";

type ChatbotRule = {
    id: string;
    trigger: string;
    response: string;
    category: string;
    audience: "public" | "verified_guest" | "staff" | "admin";
    source: string | null;
    version: number;
    approvedAt: string | null;
    approvedBy: string | null;
    isActive: boolean;
};

type EditableRule = Pick<ChatbotRule, "trigger" | "response" | "audience"> & { source: string };

const AUDIENCE_LABELS: Record<ChatbotRule["audience"], string> = {
    public: "Público",
    verified_guest: "Hóspede verificado",
    staff: "Equipe",
    admin: "Administração",
};

const AUTO_REPLY_INTENT_LABELS = {
    quote: "Cotação",
    reservation: "Reserva",
    checkin_info: "Informações de check-in",
    checkout_info: "Informações de check-out",
    amenity: "Comodidades",
    pet: "Pets",
    parking: "Estacionamento",
    location: "Localização",
} as const;

type AutoReplyIntent = keyof typeof AUTO_REPLY_INTENT_LABELS;

type RolloutGate = {
    approved: boolean;
    reasons: string[];
    metrics: {
        shadowSample: number;
        shadowAgreementRate: number | null;
        shadowAuthorizedActions: number;
        supervisedReviewed: number;
        humanShadowReviewed: number;
        humanShadowApprovalRate: number | null;
    };
};

const ROLLOUT_REASON_LABELS: Record<string, string> = {
    insufficient_shadow_sample: "Amostra shadow insuficiente",
    shadow_agreement_below_threshold: "Concordância shadow abaixo de 80%",
    shadow_action_was_authorized: "Uma ação foi autorizada durante shadow",
    insufficient_supervised_reviews: "Revisões supervisionadas insuficientes",
    insufficient_human_shadow_reviews: "Revisões humanas do shadow insuficientes",
    human_shadow_approval_below_threshold: "Aprovação humana do shadow abaixo de 80%",
};

export default function ChatbotSettingsPage() {
    const [rules, setRules] = useState<ChatbotRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [globalEnabled, setGlobalEnabled] = useState(false);
    const [pipelineAutomationEnabled, setPipelineAutomationEnabled] = useState(true);
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [isPipelineLoading, setIsPipelineLoading] = useState(true);
    const [releasedIntents, setReleasedIntents] = useState<AutoReplyIntent[]>(["quote"]);
    const [isIntentSaving, setIsIntentSaving] = useState(false);
    const [rolloutPercentage, setRolloutPercentage] = useState(0);
    const [savedRolloutPercentage, setSavedRolloutPercentage] = useState(0);
    const [isRolloutSaving, setIsRolloutSaving] = useState(false);
    const [rolloutGate, setRolloutGate] = useState<RolloutGate | null>(null);

    const [newRule, setNewRule] = useState<EditableRule>({ trigger: "", response: "", audience: "public", source: "" });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editRule, setEditRule] = useState<EditableRule>({ trigger: "", response: "", audience: "public", source: "" });

    async function fetchRules() {
        try {
            const response = await fetch("/api/admin/chatbot/rules");
            const data = await response.json();
            if (data.ok) setRules(data.rules);
        } catch {
            setError("Erro ao carregar regras");
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchGlobalSettings() {
        try {
            const response = await fetch("/api/admin/chatbot/settings");
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error("Falha ao carregar estado global");
            setGlobalEnabled(Boolean(data.settings.enabledGlobal && data.settings.enabledWhatsapp));
            setPipelineAutomationEnabled(Boolean(data.settings.pipelineAutomationEnabled));
            setReleasedIntents(Array.isArray(data.settings.releasedAutoReplyIntents)
                ? data.settings.releasedAutoReplyIntents
                : ["quote"]);
            const percentage = Number.isInteger(data.settings.autoReplyRolloutPercentage)
                ? Math.max(0, Math.min(100, data.settings.autoReplyRolloutPercentage))
                : 0;
            setRolloutPercentage(percentage);
            setSavedRolloutPercentage(percentage);
            setRolloutGate(data.rolloutGate ?? null);
        } catch {
            setError("Não foi possível confirmar o estado global. O chatbot permanece bloqueado por segurança.");
            setGlobalEnabled(false);
        } finally {
            setIsGlobalLoading(false);
            setIsPipelineLoading(false);
        }
    }

    async function handleRolloutSave() {
        setIsRolloutSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/chatbot/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ autoReplyRolloutPercentage: rolloutPercentage }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error("Falha ao atualizar percentual");
            const saved = Number(data.settings.autoReplyRolloutPercentage);
            setRolloutPercentage(saved);
            setSavedRolloutPercentage(saved);
            setSuccess(`Rollout atualizado para ${saved}%.`);
            setTimeout(() => setSuccess(null), 3000);
        } catch {
            setError("Erro ao atualizar o percentual de rollout.");
        } finally {
            setIsRolloutSaving(false);
        }
    }

    async function handleIntentToggle(intent: AutoReplyIntent) {
        const nextIntents = releasedIntents.includes(intent)
            ? releasedIntents.filter(item => item !== intent)
            : [...releasedIntents, intent];
        setIsIntentSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/chatbot/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ releasedAutoReplyIntents: nextIntents }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error("Falha ao atualizar rollout");
            setReleasedIntents(data.settings.releasedAutoReplyIntents);
            setSuccess("Liberação por intenção atualizada.");
            setTimeout(() => setSuccess(null), 3000);
        } catch {
            setError("Erro ao atualizar as intenções liberadas.");
        } finally {
            setIsIntentSaving(false);
        }
    }

    async function handlePipelineToggle() {
        const nextEnabled = !pipelineAutomationEnabled;
        setIsPipelineLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/chatbot/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pipelineAutomationEnabled: nextEnabled }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error("Falha ao atualizar automação do funil");
            setPipelineAutomationEnabled(Boolean(data.settings.pipelineAutomationEnabled));
            setSuccess(nextEnabled
                ? "Monitoramento automático do Kanban ativado."
                : "Monitoramento automático do Kanban desativado.");
            setTimeout(() => setSuccess(null), 3000);
        } catch {
            setError("Erro ao atualizar o monitoramento automático do Kanban.");
        } finally {
            setIsPipelineLoading(false);
        }
    }

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchRules();
            void fetchGlobalSettings();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, []);

    async function handleGlobalToggle() {
        const nextEnabled = !globalEnabled;
        if (nextEnabled && !confirm("Ativar respostas automáticas para todas as conversas que estiverem com Chatbot ON?")) {
            return;
        }

        setIsGlobalLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/chatbot/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: nextEnabled }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error("Falha ao atualizar estado global");
            setGlobalEnabled(nextEnabled);
            setSuccess(nextEnabled ? "Chatbot ativado globalmente." : "Chatbot desativado globalmente.");
            setTimeout(() => setSuccess(null), 3000);
        } catch {
            setError("Erro ao atualizar o interruptor global do chatbot.");
        } finally {
            setIsGlobalLoading(false);
        }
    }

    async function handleAddRule() {
        if (!newRule.trigger || !newRule.response) return;
        setIsSaving(true);
        try {
            const response = await fetch("/api/admin/chatbot/rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newRule),
            });
            const data = await response.json();
            if (data.ok) {
                setRules([data.rule, ...rules]);
                setNewRule({ trigger: "", response: "", audience: "public", source: "" });
                setSuccess("Regra adicionada!");
                setTimeout(() => setSuccess(null), 3000);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            setError(err.message || "Erro ao adicionar regra");
            setTimeout(() => setError(null), 5000);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleUpdateRule() {
        if (!editingId || !editRule.trigger || !editRule.response) return;
        setIsSaving(true);
        try {
            const response = await fetch("/api/admin/chatbot/rules", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editingId, ...editRule }),
            });
            if (response.ok) {
                setRules(rules.map(r => r.id === editingId ? { ...r, ...editRule, version: r.version + 1, approvedAt: new Date().toISOString() } : r));
                setEditingId(null);
                setSuccess("Regra atualizada!");
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch {
            setError("Erro ao atualizar regra");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDeleteRule(id: string) {
        if (!confirm("Tem certeza que deseja excluir esta regra?")) return;
        try {
            const response = await fetch(`/api/admin/chatbot/rules?id=${id}`, { method: "DELETE" });
            if (response.ok) {
                setRules(rules.filter(r => r.id !== id));
            }
        } catch {
            setError("Erro ao excluir regra");
        }
    }

    async function handleToggleRule(id: string, isActive: boolean) {
        try {
            const response = await fetch("/api/admin/chatbot/rules", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, isActive: !isActive }),
            });
            if (response.ok) {
                setRules(rules.map(r => r.id === id ? { ...r, isActive: !isActive } : r));
            }
        } catch {
            setError("Erro ao atualizar regra");
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-600 p-2 rounded-xl text-white">
                        <Bot size={28} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Configurações do Chatbot</h1>
                </div>
                <p className="text-slate-500 font-medium">Gerencie a base aprovada de respostas automáticas do WhatsApp.</p>
            </header>

            <section className={`rounded-2xl border p-6 shadow-sm ${globalEnabled ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <div className={`rounded-xl p-2 text-white ${globalEnabled ? "bg-emerald-600" : "bg-red-600"}`}>
                            <Power size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">Interruptor geral do chatbot</h2>
                            <p className="text-sm font-medium text-slate-600">
                                {globalEnabled
                                    ? "Respostas automáticas estão liberadas nas conversas com Chatbot ON."
                                    : "Todas as respostas automáticas do WhatsApp estão bloqueadas. O atendimento manual continua funcionando."}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleGlobalToggle}
                        disabled={isGlobalLoading}
                        className={`min-w-48 rounded-xl px-5 py-3 text-sm font-black text-white transition disabled:opacity-50 ${globalEnabled ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                    >
                        {isGlobalLoading ? "Verificando..." : globalEnabled ? "DESATIVAR BOT GERAL" : "ATIVAR BOT GERAL"}
                    </button>
                </div>
            </section>

            <section className={`rounded-2xl border p-6 shadow-sm ${pipelineAutomationEnabled ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <div className={`rounded-xl p-2 text-white ${pipelineAutomationEnabled ? "bg-sky-600" : "bg-slate-500"}`}>
                            <Columns3 size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">Monitoramento automático do Kanban</h2>
                            <p className="text-sm font-medium text-slate-600">
                                {pipelineAutomationEnabled
                                    ? "O CRM acompanha as mensagens e move os cards somente quando identifica um marco válido. Isso não envia respostas ao hóspede."
                                    : "As conversas continuam chegando, mas nenhuma coluna será alterada automaticamente."}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handlePipelineToggle}
                        disabled={isPipelineLoading}
                        className={`min-w-48 rounded-xl px-5 py-3 text-sm font-black text-white transition disabled:opacity-50 ${pipelineAutomationEnabled ? "bg-slate-600 hover:bg-slate-700" : "bg-sky-600 hover:bg-sky-700"}`}
                    >
                        {isPipelineLoading ? "Verificando..." : pipelineAutomationEnabled ? "DESATIVAR KANBAN AUTO" : "ATIVAR KANBAN AUTO"}
                    </button>
                </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-amber-500 p-2 text-white">
                        <ShieldCheck size={24} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-black text-slate-800">Liberação gradual por intenção</h2>
                        <p className="mt-1 text-sm font-medium text-slate-600">
                            Selecione somente intenções já revisadas. As demais são encaminhadas à equipe sem resposta improvisada. Conversas marcadas para teste continuam liberadas isoladamente.
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {(Object.entries(AUTO_REPLY_INTENT_LABELS) as Array<[AutoReplyIntent, string]>).map(([intent, label]) => {
                                const enabled = releasedIntents.includes(intent);
                                return (
                                    <button
                                        key={intent}
                                        type="button"
                                        onClick={() => handleIntentToggle(intent)}
                                        disabled={isIntentSaving || isGlobalLoading}
                                        aria-pressed={enabled}
                                        className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition disabled:opacity-50 ${enabled
                                            ? "border-emerald-300 bg-white text-emerald-700 shadow-sm"
                                            : "border-amber-200 bg-amber-100/50 text-slate-500 hover:bg-white"}`}
                                    >
                                        <span className="block">{label}</span>
                                        <span className="mt-1 block text-[11px] uppercase tracking-wider">{enabled ? "Liberada" : "Em revisão"}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div className="flex-1">
                                    <label htmlFor="rollout-percentage" className="text-sm font-black text-slate-800">
                                        Percentual de conversas em produção: {rolloutPercentage}%
                                    </label>
                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                        A seleção é estável por conversa. Em 0%, somente conversas explicitamente marcadas para teste podem responder.
                                    </p>
                                    <input
                                        id="rollout-percentage"
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={rolloutPercentage}
                                        onChange={event => setRolloutPercentage(Number(event.target.value))}
                                        className="mt-3 w-full accent-emerald-600"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRolloutSave}
                                    disabled={isRolloutSaving || rolloutPercentage === savedRolloutPercentage}
                                    className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isRolloutSaving ? "Salvando..." : "Salvar percentual"}
                                </button>
                            </div>
                            {rolloutGate && (
                                <div className={`mt-4 rounded-lg border p-3 text-xs font-semibold ${rolloutGate.approved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                                    <p className="font-black">Gate de expansão: {rolloutGate.approved ? "aprovado" : "bloqueado"}</p>
                                    <p className="mt-1">
                                        Shadow: {rolloutGate.metrics.shadowSample} · Concordância: {rolloutGate.metrics.shadowAgreementRate === null ? "—" : `${Math.round(rolloutGate.metrics.shadowAgreementRate * 100)}%`} · Revisões humanas: {rolloutGate.metrics.humanShadowReviewed} ({rolloutGate.metrics.humanShadowApprovalRate === null ? "—" : `${Math.round(rolloutGate.metrics.humanShadowApprovalRate * 100)}%`}) · Revisões supervisionadas: {rolloutGate.metrics.supervisedReviewed}
                                    </p>
                                    {!rolloutGate.approved && rolloutGate.reasons.length > 0 && (
                                        <ul className="mt-2 list-disc pl-5">
                                            {rolloutGate.reasons.map(reason => <li key={reason}>{ROLLOUT_REASON_LABELS[reason] ?? reason}</li>)}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <DecisionReviewPanel />
            <SupervisedSuggestionPanel />

            {/* Nova Regra */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Plus size={20} className="text-emerald-600" />
                    Nova Regra de Resposta
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Palavra-chave (Gatilho)</label>
                        <input
                            type="text"
                            placeholder="Ex: Preço, Localização, Oi"
                            value={newRule.trigger}
                            onChange={e => setNewRule({ ...newRule, trigger: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resposta Automática</label>
                        <textarea
                            placeholder="O que o bot deve responder..."
                            value={newRule.response}
                            onChange={e => setNewRule({ ...newRule, response: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium h-[46px] min-h-[46px] resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Público autorizado</label>
                        <select
                            value={newRule.audience}
                            onChange={e => setNewRule({ ...newRule, audience: e.target.value as ChatbotRule["audience"] })}
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-none transition-all focus:ring-2 focus:ring-emerald-500"
                        >
                            {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fonte da informação</label>
                        <input
                            type="text"
                            placeholder="Ex: Confirmado pela administração em 07/08/2026"
                            value={newRule.source}
                            onChange={e => setNewRule({ ...newRule, source: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-none transition-all focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={handleAddRule}
                        disabled={isSaving || !newRule.trigger || !newRule.response || !newRule.source}
                        className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition-all disabled:opacity-50"
                    >
                        {isSaving ? "Salvando..." : "Adicionar Regra"}
                    </button>
                </div>
            </section>

            {/* Feedbacks */}
            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center gap-3 font-medium animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-4 rounded-xl flex items-center gap-3 font-medium animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 size={20} />
                    {success}
                </div>
            )}

            {/* Lista de Regras */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-black text-slate-800">Base de respostas aprovadas</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Somente regras públicas, aprovadas e marcadas como Ativo podem ser enviadas automaticamente.</p>
                </div>
                {isLoading ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
                    </div>
                ) : rules.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-bold">Nenhuma regra cadastrada ainda.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {rules.map(rule => (
                            <div key={rule.id} className={`bg-white p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${rule.isActive ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-60 grayscale'}`}>
                                {editingId === rule.id ? (
                                    <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gatilho</label>
                                            <input
                                                type="text"
                                                value={editRule.trigger}
                                                onChange={e => setEditRule({ ...editRule, trigger: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resposta</label>
                                            <textarea
                                                value={editRule.response}
                                                onChange={e => setEditRule({ ...editRule, response: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none h-10 resize-none font-medium"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Público</label>
                                            <select
                                                value={editRule.audience}
                                                onChange={e => setEditRule({ ...editRule, audience: e.target.value as ChatbotRule["audience"] })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                                            >
                                                {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fonte</label>
                                            <input
                                                type="text"
                                                value={editRule.source}
                                                onChange={e => setEditRule({ ...editRule, source: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-tighter italic">Trigger</span>
                                            <span className="font-black text-lg text-slate-800">&quot;{rule.trigger}&quot;</span>
                                        </div>
                                        <p className="text-slate-600 font-medium line-clamp-2 italic text-sm">
                                            &quot;{rule.response}&quot;
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold">
                                            <span className={rule.audience === "public" ? "rounded-full bg-emerald-100 px-2 py-1 text-emerald-700" : "rounded-full bg-amber-100 px-2 py-1 text-amber-800"}>
                                                {AUDIENCE_LABELS[rule.audience]}
                                            </span>
                                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Versão {rule.version}</span>
                                            <span className="text-slate-400">{rule.source || "Sem fonte registrada"}</span>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-3 shrink-0">
                                    {editingId === rule.id ? (
                                        <>
                                            <button
                                                onClick={handleUpdateRule}
                                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Salvar"
                                            >
                                                <Save size={20} />
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"
                                                title="Cancelar"
                                            >
                                                <X size={20} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setEditingId(rule.id);
                                                    setEditRule({
                                                        trigger: rule.trigger,
                                                        response: rule.response,
                                                        audience: rule.audience,
                                                        source: rule.source || "",
                                                    });
                                                }}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Pencil size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleToggleRule(rule.id, rule.isActive)}
                                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${rule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
                                            >
                                                {rule.isActive ? 'Ativo' : 'Inativo'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteRule(rule.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
