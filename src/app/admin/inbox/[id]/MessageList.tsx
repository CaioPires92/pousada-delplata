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
        <div className="space-y-3">
            {messages.length === 0 ? (
                <p className="text-slate-500">Nenhuma mensagem encontrada.</p>
            ) : (
                messages.map((message) => {
                    const isGuest = message.senderType === "guest";

                    return (
                        <div
                            key={message.id}
                            className={`flex ${isGuest ? "justify-start" : "justify-end"}`}
                        >
                            <div
                                className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${isGuest
                                    ? "bg-slate-100 text-slate-900"
                                    : "bg-emerald-600 text-white"
                                    }`}
                            >
                                <p className="text-xs font-semibold uppercase opacity-70">
                                    {message.senderType}
                                </p>
                                <p className="mt-1">{message.content}</p>
                                <p className="mt-2 text-xs opacity-60">
                                    {new Date(message.sentAt || message.createdAt).toLocaleString(
                                        "pt-BR"
                                    )}
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
