"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ChatbotToggleProps = {
    automationMode: "off" | "supervised" | "auto";
    conversationId: string;
    chatbotTestEnabled: boolean;
};

const MODE_OPTIONS = [
    { value: "off", label: "Desligado" },
    { value: "supervised", label: "Supervisionado" },
    { value: "auto", label: "Automático" },
] as const;

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return "Erro ao atualizar chatbot";
}

export default function ChatbotToggle({
    automationMode,
    conversationId,
    chatbotTestEnabled,
}: ChatbotToggleProps) {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleModeChange(mode: ChatbotToggleProps["automationMode"]) {
        if (mode === automationMode) return;
        setIsUpdating(true);
        setError(null);

        try {
            const response = await fetch(`/api/crm/conversations/${conversationId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    automationMode: mode,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Falha ao atualizar chatbot");
            }

            router.refresh();
        } catch (err) {
            console.error("Erro ao alterar modo da automação:", err);
            setError(getErrorMessage(err));
        } finally {
            setIsUpdating(false);
        }
    }

    async function handleTakeOver() {
        setIsUpdating(true);
        setError(null);

        try {
            const response = await fetch(`/api/crm/conversations/${conversationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ automationMode: "off" }),
            });

            if (!response.ok) throw new Error("Falha ao desativar chatbot");

            router.refresh();
        } catch (err) {
            console.error("Erro ao assumir conversa:", err);
            setError("Erro ao assumir conversa");
        } finally {
            setIsUpdating(false);
        }
    }

    async function handleTestOverride() {
        setIsUpdating(true);
        setError(null);

        try {
            const response = await fetch(`/api/crm/conversations/${conversationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatbotTestEnabled: !chatbotTestEnabled }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Falha ao atualizar teste do chatbot");
            router.refresh();
        } catch (err) {
            console.error("Erro ao alterar teste do chatbot:", err);
            setError(getErrorMessage(err));
        } finally {
            setIsUpdating(false);
        }
    }

    return (
        <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
                {automationMode === "auto" && (
                    <button
                        type="button"
                        disabled={isUpdating}
                        onClick={handleTakeOver}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-600 bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50"
                    >
                        Assumir Conversa
                    </button>
                )}

                <div role="group" aria-label="Modo da automação" className="flex rounded-full border border-slate-200 bg-slate-50 p-1">
                    {MODE_OPTIONS.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={automationMode === option.value}
                            disabled={isUpdating}
                            onClick={() => handleModeChange(option.value)}
                            className={`rounded-full px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                                automationMode === option.value
                                    ? option.value === "auto"
                                        ? "bg-emerald-600 text-white"
                                        : option.value === "supervised"
                                            ? "bg-sky-600 text-white"
                                            : "bg-slate-700 text-white"
                                    : "text-slate-500 hover:bg-white hover:text-slate-800"
                            }`}
                        >
                            {isUpdating && automationMode === option.value ? "Atualizando" : option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col items-start gap-1 sm:items-end">
                <button
                    type="button"
                    aria-pressed={chatbotTestEnabled}
                    disabled={isUpdating}
                    onClick={handleTestOverride}
                    className={`rounded-full border px-3 py-2 text-xs font-black transition-colors disabled:opacity-50 ${
                        chatbotTestEnabled
                            ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
                            : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    }`}
                >
                    {chatbotTestEnabled ? "Teste do bot ativo nesta conversa" : "Ativar bot só nesta conversa"}
                </button>
                <p className="text-[10px] font-semibold text-slate-400">
                    O interruptor geral permanece desligado.
                </p>
            </div>

            {error && (
                <p className="max-w-[240px] text-left text-xs font-medium text-red-600 sm:text-right">
                    {error}
                </p>
            )}
        </div>
    );
}
