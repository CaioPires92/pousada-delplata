"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MessageCircle, Phone } from "lucide-react";

type PipelineCard = {
    id: string;
    stage: string;
    priority: string;
    source: string;
    assignedUserId: string | null;
    lastActivityAt: string | null;
    createdAt: string;
    updatedAt: string;
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

const STAGE_LABELS: Record<string, string> = {
    novo: "Novo",
    em_atendimento: "Em atendimento",
    proposta: "Proposta",
    fechado: "Fechado",
    perdido: "Perdido",
};

function formatStageLabel(stage: string): string {
    return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

function formatDateTime(value: string | null): string {
    if (!value) {
        return "Sem atividade";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "Sem atividade";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(parsed);
}

function getPriorityStyle(priority: string): string {
    if (priority === "alta") {
        return "border-red-200 bg-red-50 text-red-700";
    }

    if (priority === "baixa") {
        return "border-slate-200 bg-slate-50 text-slate-600";
    }

    return "border-amber-200 bg-amber-50 text-amber-700";
}

const STAGE_OPTIONS = Object.keys(STAGE_LABELS);

export default function AdminPipelinePage() {
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [movingCardId, setMovingCardId] = useState<string | null>(null);

    const loadPipeline = useCallback(async (options?: { keepLoadingState?: boolean }) => {
        try {
            setError(null);
            if (!options?.keepLoadingState) {
                setLoading(true);
            }

            const response = await fetch("/api/crm/pipeline", {
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error("Falha ao carregar pipeline");
            }

            const data = await response.json() as PipelineResponse;
            setStages(Array.isArray(data.stages) ? data.stages : []);
        } catch (err) {
            console.error("Erro ao carregar pipeline do CRM:", err);
            setError("Não foi possível carregar o pipeline.");
            setStages([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPipeline();
    }, [loadPipeline]);

    async function handleStageChange(cardId: string, nextStage: string) {
        setMovingCardId(cardId);
        setError(null);

        try {
            const response = await fetch(`/api/crm/pipeline/${cardId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    stage: nextStage,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Falha ao mover card");
            }

            await loadPipeline({ keepLoadingState: true });
        } catch (err) {
            console.error("Erro ao mover card do pipeline:", err);
            setError("Não foi possível mover o card.");
        } finally {
            setMovingCardId(null);
        }
    }

    const totalCards = useMemo(
        () => stages.reduce((total, stage) => total + stage.cards.length, 0),
        [stages]
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
                        CRM Delplata
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-slate-950">
                        Kanban WhatsApp
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Acompanhamento dos cards comerciais criados a partir do atendimento.
                    </p>
                </div>

                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                    {totalCards} cards
                </div>
            </header>

            {loading ? (
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
                    <div className="flex items-center gap-3 text-sm font-semibold">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Carregando pipeline...
                    </div>
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-sm font-medium text-red-700">
                    {error}
                </div>
            ) : (
                <section className="grid gap-4 xl:grid-cols-5">
                    {stages.map((stage) => (
                        <div
                            key={stage.stage}
                            className="min-h-[420px] rounded-2xl border border-slate-200 bg-slate-50"
                        >
                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                    {formatStageLabel(stage.stage)}
                                </h2>
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                                    {stage.cards.length}
                                </span>
                            </div>

                            <div className="space-y-3 p-3">
                                {stage.cards.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
                                        Nenhum card
                                    </div>
                                ) : (
                                    stage.cards.map((card) => (
                                        <article
                                            key={card.id}
                                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-sm font-bold text-slate-950">
                                                        {card.contact.name}
                                                    </h3>
                                                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                                        <Phone className="h-3.5 w-3.5" />
                                                        {card.contact.phone ?? "Sem telefone"}
                                                    </p>
                                                </div>
                                                <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold uppercase ${getPriorityStyle(card.priority)}`}>
                                                    {card.priority}
                                                </span>
                                            </div>

                                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                                                {card.conversation?.lastMessage ?? "Sem mensagem recente"}
                                            </p>

                                            <div className="mt-4 space-y-2 text-xs text-slate-500">
                                                <p>
                                                    Atividade: {formatDateTime(card.lastActivityAt ?? card.conversation?.lastMessageAt ?? null)}
                                                </p>
                                                <p className="flex items-center gap-1.5">
                                                    <MessageCircle className="h-3.5 w-3.5" />
                                                    {card.source} · {card.conversation?.channel ?? "sem conversa"}
                                                </p>
                                            </div>

                                            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                Stage
                                                <select
                                                    value={card.stage}
                                                    disabled={movingCardId === card.id}
                                                    onChange={(event) => handleStageChange(card.id, event.target.value)}
                                                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                >
                                                    {STAGE_OPTIONS.map((stageOption) => (
                                                        <option key={stageOption} value={stageOption}>
                                                            {formatStageLabel(stageOption)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            {card.conversation && (
                                                <Link
                                                    href={`/admin/inbox/${card.conversation.id}`}
                                                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                                >
                                                    Abrir conversa
                                                    <ArrowRight className="h-4 w-4" />
                                                </Link>
                                            )}
                                        </article>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}
