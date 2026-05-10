import { headers } from "next/headers";
import ChatbotToggle from "./ChatbotToggle";
import ReplyBox from "./ReplyBox";
import MessageList from "./MessageList";
import SalesSidebar from "./SalesSidebar";

type Message = {
    id: string;
    senderType: string;
    content: string | null;
    messageType: string;
    createdAt: string;
    sentAt: string | null;
};

type PipelineCard = {
    id: string;
    estimatedValue: number | null;
    intendedArrival: string | null;
    stage: string;
    bookingId: string | null;
};

type ConversationDetail = {
    id: string;
    status: string;
    channel: string;
    chatbotEnabled: boolean;
    automationPausedUntil: string | null;
    contact: {
        id: string;
        name: string;
        phone: string | null;
    };
    pipelineCard: PipelineCard | null;
    messages: Message[];
};

function formatDateTime(value: string | null): string {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

function getChatbotStatus(conversation: ConversationDetail): { label: string; tone: string; } {
    const pausedUntil = conversation.automationPausedUntil ? new Date(conversation.automationPausedUntil) : null;
    const isPaused = pausedUntil !== null && pausedUntil.getTime() > Date.now();
    if (isPaused) {
        return {
            label: `Chatbot pausado até ${formatDateTime(conversation.automationPausedUntil)}`,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
        };
    }
    if (conversation.chatbotEnabled) {
        return { label: "Chatbot ativo", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    }
    return { label: "Chatbot desligado", tone: "border-slate-200 bg-slate-50 text-slate-600" };
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
                                    chatbotEnabled={conversation.chatbotEnabled}
                                    conversationId={conversation.id}
                                />
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-auto bg-slate-50 p-6">
                        <MessageList
                            initialMessages={conversation.messages}
                            conversationId={conversation.id}
                        />
                    </div>

                    <div className="border-t border-slate-200 p-4">
                        <ReplyBox conversationId={conversation.id} />
                    </div>
                </section>

                {/* Sales Sidebar */}
                <SalesSidebar 
                    conversationId={conversation.id} 
                    initialCard={conversation.pipelineCard} 
                />
            </div>
        </main>
    );
}
