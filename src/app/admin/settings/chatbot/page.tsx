"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, MessageSquare, Bot, AlertCircle, CheckCircle2, Pencil, X } from "lucide-react";

type ChatbotRule = {
    id: string;
    trigger: string;
    response: string;
    category: string;
    isActive: boolean;
};

export default function ChatbotSettingsPage() {
    const [rules, setRules] = useState<ChatbotRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [newRule, setNewRule] = useState({ trigger: "", response: "" });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editRule, setEditRule] = useState({ trigger: "", response: "" });

    async function fetchRules() {
        try {
            const response = await fetch("/api/admin/chatbot/rules");
            const data = await response.json();
            if (data.ok) setRules(data.rules);
        } catch (err) {
            setError("Erro ao carregar regras");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchRules();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, []);

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
                setNewRule({ trigger: "", response: "" });
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
                setRules(rules.map(r => r.id === editingId ? { ...r, ...editRule } : r));
                setEditingId(null);
                setSuccess("Regra atualizada!");
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
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
        } catch (err) {
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
        } catch (err) {
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
                <p className="text-slate-500 font-medium">Gerencie as respostas automáticas do seu CRM de WhatsApp.</p>
            </header>

            {/* Nova Regra */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Plus size={20} className="text-emerald-600" />
                    Nova Regra de Resposta
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={handleAddRule}
                        disabled={isSaving || !newRule.trigger || !newRule.response}
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
                <h2 className="text-xl font-black text-slate-800">Regras Ativas</h2>
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
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                    setEditRule({ trigger: rule.trigger, response: rule.response });
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
