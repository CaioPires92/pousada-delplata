"use client";

import { useEffect, useState } from "react";

type Message = {
    id: string;
    senderType: string;
    content: string | null;
    messageType: string;
    createdAt: string;
    sentAt: string | null;
};

interface MessageListProps {
    initialMessages: Message[];
    conversationId: string;
}

function formatMessageTime(message: Message): string {
    const parsed = new Date(message.sentAt || message.createdAt);
    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(parsed);
}

function getMessageStyle(senderType: string): {
    alignment: string;
    bubble: string;
    label: string;
} {
    if (senderType === "human") {
        return {
            alignment: "justify-end",
            bubble: "bg-emerald-600 text-white",
            label: "Recepção",
        };
    }

    if (senderType === "bot") {
        return {
            alignment: "justify-end",
            bubble: "border border-sky-200 bg-sky-50 text-sky-950",
            label: "Bot",
        };
    }

    return {
        alignment: "justify-start",
        bubble: "border border-slate-200 bg-white text-slate-950",
        label: "Hóspede",
    };
}

export default function MessageList({ initialMessages, conversationId }: MessageListProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);

    // Sincronizar com props iniciais (ex: quando o ReplyBox chama router.refresh())
    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);

    // Polling a cada 5 segundos
    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                const response = await fetch(`/api/crm/conversations/${conversationId}`, {
                    cache: "no-store",
                });
                if (!response.ok) return;

                const data = await response.json();
                if (data && data.messages) {
                    setMessages(data.messages);
                }
            } catch (error) {
                console.error("Erro no polling de mensagens:", error);
            }
        }, 5000);

        return () => clearInterval(intervalId);
    }, [conversationId]);

    return (
        <div className="min-h-[420px] space-y-3 rounded-2xl bg-slate-50 px-3 py-4 sm:px-4">
            {messages.length === 0 ? (
                <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
                    Nenhuma mensagem encontrada.
                </div>
            ) : (
                messages.map((message) => {
                    const style = getMessageStyle(message.senderType);

                    return (
                        <div
                            key={message.id}
                            className={`flex ${style.alignment}`}
                        >
                            <div
                                className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[70%] ${style.bubble}`}
                            >
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
                                        {style.label}
                                    </p>
                                    <p className="text-xs opacity-60">
                                        {message.messageType}
                                    </p>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                                    {message.content || "Mensagem sem texto"}
                                </p>
                                <p className="mt-2 text-right text-xs opacity-60">
                                    {formatMessageTime(message)}
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
