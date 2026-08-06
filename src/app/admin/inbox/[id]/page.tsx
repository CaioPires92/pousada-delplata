import { headers } from "next/headers";
import ChatbotToggle from "./ChatbotToggle";
import ReplyBox from "./ReplyBox";
import MessageList from "./MessageList";
import InternalNotesPanel from "./InternalNotesPanel";

type Message = {
    id: string;
    senderType: string;
    content: string | null;
    messageType: string;
    deliveryStatus: "sent" | "delivered" | "read" | "failed" | "retrying" | null;
    deliveryErrorTitle: string | null;
    deliveryErrorDetail: string | null;
    deliveryUpdatedAt: string | null;
    createdAt: string;
    sentAt: string | null;
};

type ConversationDetail = {
    id: string;
    status: string;
    channel: string;
    chatbotEnabled: boolean;
    chatbotTestEnabled: boolean;
    automationMode: "off" | "supervised" | "auto";
    automationPausedUntil: string | null;
    contact: {
        id: string;
        name: string;
        phone: string | null;
    };
    messages: Message[];
};

function formatDateTime(value: string | null): string {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

function getChatbotStatus(conversation: ConversationDetail): { label: string; tone: string; } {
    if (conversation.automationMode === "off") {
        return { label: "Automação desligada", tone: "border-slate-200 bg-slate-50 text-slate-600" };
    }
    if (conversation.automationMode === "supervised") {
        return { label: "Modo supervisionado", tone: "border-sky-200 bg-sky-50 text-sky-700" };
    }

    const pausedUntil = conversation.automationPausedUntil ? new Date(conversation.automationPausedUntil) : null;
    const isPaused = pausedUntil !== null && pausedUntil.getTime() > Date.now();
    if (isPaused) {
        return {
            label: `Automação pausada por atendimento humano até ${formatDateTime(conversation.automationPausedUntil)}`,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
        };
    }
    return { label: "Modo automático", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

async function getConversation(id: string): Promise<ConversationDetail> {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const response = await fetch(`${protocol}://${host}/api/crm/conversations/${id}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Conversa não encontrada");
    return response.json();
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }>; }) {
    const { id } = await params;
    const conversation = await getConversation(id);
    const chatbotStatus = getChatbotStatus(conversation);

    return (
        <main className="h-screen bg-slate-100 flex flex-col">
            <div className="flex-1 flex overflow-hidden">
                {/* Chat Area */}
                <section className="flex-1 flex flex-col bg-white overflow-hidden">
                    <header className="border-b border-slate-200 px-6 py-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Lead Delplata</p>
                                <h1 className="truncate text-xl font-black text-slate-950">{conversation.contact.name}</h1>
                                <p className="text-xs font-bold text-slate-400">{conversation.contact.phone ?? "Sem telefone"}</p>
                            </div>

                            <div className="flex flex-col gap-2 sm:items-end">
                                <div className="flex gap-2">
                                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${chatbotStatus.tone}`}>
                                        {chatbotStatus.label}
                                    </span>
                                </div>
                                <ChatbotToggle
                                    automationMode={conversation.automationMode}
                                    conversationId={conversation.id}
                                    chatbotTestEnabled={conversation.chatbotTestEnabled}
                                />
                            </div>
                        </div>
                        <InternalNotesPanel conversationId={conversation.id} />
                    </header>

                    <div className="flex-1 overflow-auto bg-slate-50 px-4 py-5 sm:px-6">
                        <MessageList
                            initialMessages={conversation.messages}
                            conversationId={conversation.id}
                        />
                    </div>

                    <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)]">
                        <ReplyBox conversationId={conversation.id} />
                    </div>
                </section>
            </div>
        </main>
    );
}
