"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReplyBoxProps {
    conversationId: string;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return "Erro inesperado ao enviar mensagem";
}

export default function ReplyBox({ conversationId }: ReplyBoxProps) {
    const [text, setText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sentFeedback, setSentFeedback] = useState<string | null>(null);
    const router = useRouter();

    async function handleSend(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const messageText = text.trim();
        if (!messageText) {
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            conversationId,
            senderType: "human",
            content: messageText,
            messageType: "text",
            createdAt: new Date().toISOString(),
            sentAt: new Date().toISOString(),
            status: 'pending' as const
        };

        // Disparar evento para o MessageList
        window.dispatchEvent(new CustomEvent('crm-new-message', { 
            detail: { conversationId, message: optimisticMessage } 
        }));

        setIsLoading(true);
        setError(null);
        setSentFeedback(null);
        setText("");

        try {
            const response = await fetch("/api/whatsapp/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    conversationId,
                    text: messageText,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Notificar erro para a mensagem específica
                window.dispatchEvent(new CustomEvent('crm-message-error', { 
                    detail: { conversationId, messageId: tempId } 
                }));
                throw new Error(data.error || "Falha ao enviar mensagem");
            }

            setSentFeedback("Mensagem enviada.");
        } catch (err) {
            console.error("Erro ao enviar:", err);
            setError(getErrorMessage(err));
            
            // Garantir que o ícone de erro apareça mesmo se o throw acontecer antes do dispatch acima
            window.dispatchEvent(new CustomEvent('crm-message-error', { 
                detail: { conversationId, messageId: tempId } 
            }));
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form className="mt-8 border-t pt-6" onSubmit={handleSend}>
            <div className="space-y-4">
                <Textarea
                    placeholder="Digite sua resposta aqui..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[100px] resize-none rounded-2xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                    disabled={isLoading}
                />
                
                {error && (
                    <p className="text-sm font-medium text-red-500">
                        {error}
                    </p>
                )}

                {sentFeedback && !error && (
                    <p className="text-sm font-medium text-emerald-600">
                        {sentFeedback}
                    </p>
                )}

                <div className="flex justify-end">
                    <Button
                        type="submit"
                        disabled={isLoading || !text.trim()}
                        className="bg-emerald-600 px-8 py-6 text-base font-semibold hover:bg-emerald-700 rounded-2xl transition-all"
                    >
                        {isLoading ? "Enviando..." : "Enviar Mensagem"}
                    </Button>
                </div>
            </div>
        </form>
    );
}
