"use client";

import { useEffect, useState } from "react";
import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

type Message = {
    id: string;
    senderType: string;
    content: string | null;
    messageType: string;
    createdAt: string;
    sentAt: string | null;
    status?: 'pending' | 'sent' | 'error';
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
            bubble: "bg-emerald-600 text-white shadow-md",
            label: "Recepção",
        };
    }

    if (senderType === "bot") {
        return {
            alignment: "justify-end",
            bubble: "border border-sky-200 bg-sky-50 text-sky-950 shadow-sm",
            label: "Bot",
        };
    }

    return {
        alignment: "justify-start",
        bubble: "border border-slate-200 bg-white text-slate-950 shadow-sm",
        label: "Hóspede",
    };
}

export default function MessageList({ initialMessages, conversationId }: MessageListProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);

    // Sincronizar com props iniciais
    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);

    // Listener para mensagens otimistas enviadas pelo ReplyBox
    useEffect(() => {
        const handleOptimisticMessage = (event: any) => {
            const { detail } = event;
            if (detail.conversationId === conversationId) {
                setMessages(prev => {
                    // Evitar duplicata se por acaso o polling já pegou
                    if (prev.some(m => m.id === detail.message.id)) return prev;
                    return [...prev, detail.message];
                });
            }
        };

        window.addEventListener('crm-new-message', handleOptimisticMessage);
        return () => window.removeEventListener('crm-new-message', handleOptimisticMessage);
    }, [conversationId]);

    // Listener para erros de envio
    useEffect(() => {
        const handleMessageError = (event: any) => {
            const { detail } = event;
            if (detail.conversationId === conversationId) {
                setMessages(prev => prev.map(m => 
                    m.id === detail.messageId ? { ...m, status: 'error' } : m
                ));
            }
        };

        window.addEventListener('crm-message-error', handleMessageError);
        return () => window.removeEventListener('crm-message-error', handleMessageError);
    }, [conversationId]);

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
                    setMessages(prev => {
                        // Mesclar mensagens mantendo as locais que ainda não voltaram do server
                        const serverMessages = data.messages as Message[];
                        const pendingLocals = prev.filter(m => m.status === 'pending' && !serverMessages.some(sm => sm.content === m.content && sm.senderType === m.senderType));
                        
                        // Ordenar por data
                        return [...serverMessages, ...pendingLocals].sort((a, b) => 
                            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                        );
                    });
                }
            } catch (error) {
                console.error("Erro no polling de mensagens:", error);
            }
        }, 5000);

        return () => clearInterval(intervalId);
    }, [conversationId]);

    return (
        <div className="min-h-[450px] space-y-4 rounded-3xl bg-slate-50/50 px-4 py-6">
            {messages.length === 0 ? (
                <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-400 font-medium">
                    Inicie a conversa enviando uma mensagem abaixo.
                </div>
            ) : (
                messages.map((message) => {
                    const style = getMessageStyle(message.senderType);
                    const isHuman = message.senderType === "human";

                    return (
                        <div
                            key={message.id}
                            className={`flex ${style.alignment}`}
                        >
                            <div
                                className={`group relative max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${style.bubble} transition-all duration-200`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                                        {style.label}
                                    </span>
                                    <span className="text-[10px] opacity-50 font-medium">
                                        {message.messageType === 'text' ? '' : message.messageType}
                                    </span>
                                </div>
                                
                                <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                                    {message.content || "..."}
                                </p>

                                <div className="mt-2 flex items-center justify-end gap-1.5 opacity-70">
                                    <span className="text-[10px] font-medium">
                                        {formatMessageTime(message)}
                                    </span>
                                    
                                    {isHuman && (
                                        <div className="flex items-center">
                                            {message.status === 'pending' && (
                                                <Clock className="h-3 w-3 animate-pulse" />
                                            )}
                                            {message.status === 'error' && (
                                                <AlertCircle className="h-3 w-3 text-red-200" />
                                            )}
                                            {(!message.status || message.status === 'sent') && (
                                                <CheckCheck className="h-3 w-3" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
