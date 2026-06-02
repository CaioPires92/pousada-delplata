"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, Clock, AlertCircle } from "lucide-react";
import { mergePolledMessages, type InboxMessage } from "./messagePolling";

type Message = InboxMessage;

interface MessageListProps {
    initialMessages: Message[];
    conversationId: string;
}

function getScrollContainer(element: HTMLElement | null): HTMLElement | null {
    let current = element?.parentElement ?? null;

    while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;

        if (overflowY === "auto" || overflowY === "scroll") {
            return current;
        }

        current = current.parentElement;
    }

    return null;
}

function isNearBottom(container: HTMLElement | null): boolean {
    if (!container) return true;

    return container.scrollHeight - container.scrollTop - container.clientHeight < 120;
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
    const rootRef = useRef<HTMLDivElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const shouldAutoScrollRef = useRef(true);
    const lastMessageId = messages[messages.length - 1]?.id;

    // Sincronizar com props iniciais
    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);

    useEffect(() => {
        const scrollContainer = getScrollContainer(rootRef.current);

        const updateAutoScrollIntent = () => {
            shouldAutoScrollRef.current = isNearBottom(scrollContainer);
        };

        updateAutoScrollIntent();
        scrollContainer?.addEventListener("scroll", updateAutoScrollIntent, { passive: true });

        return () => {
            scrollContainer?.removeEventListener("scroll", updateAutoScrollIntent);
        };
    }, []);

    useEffect(() => {
        if (shouldAutoScrollRef.current) {
            bottomRef.current?.scrollIntoView({ block: "end" });
        }
    }, [lastMessageId]);

    // Listener para mensagens otimistas enviadas pelo ReplyBox
    useEffect(() => {
        const handleOptimisticMessage = (event: Event) => {
            const { detail } = event as CustomEvent<{ conversationId: string; message: Message }>;
            if (detail.conversationId === conversationId) {
                shouldAutoScrollRef.current = true;
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
        const handleMessageError = (event: Event) => {
            const { detail } = event as CustomEvent<{ conversationId: string; messageId: string }>;
            if (detail.conversationId === conversationId) {
                setMessages(prev => prev.map(m => 
                    m.id === detail.messageId ? { ...m, status: 'error' } : m
                ));
            }
        };

        window.addEventListener('crm-message-error', handleMessageError);
        return () => window.removeEventListener('crm-message-error', handleMessageError);
    }, [conversationId]);

    // Polling controlado a cada 3 segundos
    useEffect(() => {
        let isDisposed = false;

        async function fetchMessages() {
            if (document.visibilityState !== "visible") return;

            try {
                const response = await fetch(`/api/crm/conversations/${conversationId}`, {
                    cache: "no-store",
                });
                if (!response.ok || isDisposed) return;

                const data = await response.json();
                if (data && data.messages) {
                    setMessages(prev => mergePolledMessages(prev, data.messages as Message[]));
                }
            } catch (error) {
                console.error("Erro no polling de mensagens:", error);
            }
        }

        const intervalId = setInterval(fetchMessages, 3000);
        window.addEventListener("focus", fetchMessages);
        document.addEventListener("visibilitychange", fetchMessages);

        if (document.visibilityState === "visible") {
            fetchMessages();
        }

        return () => {
            isDisposed = true;
            clearInterval(intervalId);
            window.removeEventListener("focus", fetchMessages);
            document.removeEventListener("visibilitychange", fetchMessages);
        };
    }, [conversationId]);

    // Realtime via SSE com fallback no polling existente.
    useEffect(() => {
        if (typeof window === "undefined") return;

        const source = new EventSource(`/api/crm/conversations/${conversationId}/stream?intervalMs=3000`);
        source.onmessage = (event) => {
            if (document.visibilityState !== "visible") return;
            try {
                const data = JSON.parse(event.data) as { ok?: boolean; messages?: Message[] };
                if (!data?.ok || !Array.isArray(data.messages)) return;
                const incomingMessages: Message[] = data.messages ?? [];
                setMessages(prev => mergePolledMessages(prev, incomingMessages));
            } catch {
                // ignore parse failures
            }
        };

        source.onerror = () => {
            source.close();
        };

        return () => {
            source.close();
        };
    }, [conversationId]);

    return (
        <div ref={rootRef} className="min-h-full space-y-4 px-1 py-2">
            {messages.length === 0 ? (
                <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-400">
                    Inicie a conversa enviando uma mensagem abaixo.
                </div>
            ) : (
                messages.map((message) => {
                    const style = getMessageStyle(message.senderType);
                    const isHuman = message.senderType === "human";
                    const hasError = message.status === "error";

                    return (
                        <div
                            key={message.id}
                            className={`flex ${style.alignment}`}
                        >
                            <div
                                className={`group relative max-w-[88%] rounded-lg px-4 py-3 sm:max-w-[74%] ${style.bubble} ${hasError ? "ring-2 ring-red-300" : ""} transition-all duration-200`}
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

                                {isHuman && message.status === "pending" && (
                                    <p className="mt-2 text-right text-[10px] font-bold uppercase tracking-widest opacity-70">
                                        Enviando
                                    </p>
                                )}

                                {isHuman && hasError && (
                                    <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-right text-[11px] font-bold text-red-700">
                                        Falha ao enviar. Tente novamente.
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
            <div ref={bottomRef} />
        </div>
    );
}
