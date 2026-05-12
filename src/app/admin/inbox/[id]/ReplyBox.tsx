"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
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
            router.refresh();
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
        <form onSubmit={handleSend}>
            <div className="space-y-3">
                <Textarea
                    placeholder="Digite sua resposta aqui..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[88px] resize-none rounded-lg border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    disabled={isLoading}
                />
                
                {error && (
                    <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                        {error}
                    </p>
                )}

                {sentFeedback && !error && (
                    <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        {sentFeedback}
                    </p>
                )}

                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {isLoading ? "Enviando pelo WhatsApp" : "Resposta manual"}
                    </p>
                    <Button
                        type="submit"
                        disabled={isLoading || !text.trim()}
                        className="h-11 rounded-lg bg-emerald-600 px-6 text-sm font-black uppercase tracking-widest hover:bg-emerald-700"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Enviando
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Enviar
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
}
