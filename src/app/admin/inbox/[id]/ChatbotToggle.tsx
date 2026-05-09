"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ChatbotToggleProps = {
    chatbotEnabled: boolean;
    conversationId: string;
};

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return "Erro ao atualizar chatbot";
}

export default function ChatbotToggle({
    chatbotEnabled,
    conversationId,
}: ChatbotToggleProps) {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleToggle() {
        setIsUpdating(true);
        setError(null);

        try {
            const response = await fetch(`/api/crm/conversations/${conversationId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    chatbotEnabled: !chatbotEnabled,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Falha ao atualizar chatbot");
            }

            router.refresh();
        } catch (err) {
            console.error("Erro ao alternar chatbot:", err);
            setError(getErrorMessage(err));
        } finally {
            setIsUpdating(false);
        }
    }

    return (
        <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
                type="button"
                role="switch"
                aria-checked={chatbotEnabled}
                disabled={isUpdating}
                onClick={handleToggle}
                className={`inline-flex h-10 min-w-[156px] items-center justify-between gap-3 rounded-full border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    chatbotEnabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
            >
                <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        chatbotEnabled ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                >
                    <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            chatbotEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                    />
                </span>
                <span className="shrink-0">
                    {isUpdating ? "Atualizando" : chatbotEnabled ? "Chatbot ON" : "Chatbot OFF"}
                </span>
            </button>

            {error && (
                <p className="max-w-[240px] text-left text-xs font-medium text-red-600 sm:text-right">
                    {error}
                </p>
            )}
        </div>
    );
}
