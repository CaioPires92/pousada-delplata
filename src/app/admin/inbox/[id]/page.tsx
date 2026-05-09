import { headers } from "next/headers";
import ChatbotToggle from "./ChatbotToggle";
import ReplyBox from "./ReplyBox";
import MessageList from "./MessageList";

type Message = {
    id: string;
    senderType: string;
    content: string | null;
    messageType: string;
    createdAt: string;
    sentAt: string | null;
};

type ConversationDetail = {
    id: string;
    status: string;
    channel: string;
    chatbotEnabled: boolean;
    automationPausedUntil: string | null;
    contact: {
        name: string;
        phone: string | null;
    };
    messages: Message[];
};

function formatDateTime(value: string | null): string {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(parsed);
}

function getChatbotStatus(conversation: ConversationDetail): {
    label: string;
    tone: string;
} {
    const pausedUntil = conversation.automationPausedUntil
        ? new Date(conversation.automationPausedUntil)
        : null;
    const isPaused = pausedUntil !== null && pausedUntil.getTime() > Date.now();

    if (isPaused) {
        return {
            label: `Chatbot pausado até ${formatDateTime(conversation.automationPausedUntil)}`,
            tone: "border-amber-200 bg-amber-50 text-amber-800",
        };
    }

    if (conversation.chatbotEnabled) {
        return {
            label: "Chatbot ativo",
            tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
        };
    }

    return {
        label: "Chatbot desligado",
        tone: "border-slate-200 bg-slate-50 text-slate-600",
    };
}

async function getConversation(id: string): Promise<ConversationDetail> {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

    const response = await fetch(
        `${protocol}://${host}/api/crm/conversations/${id}`,
        { cache: "no-store" }
    );

    if (!response.ok) {
        throw new Error("Conversa não encontrada");
    }

    return response.json();
}



export default async function ConversationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const conversation = await getConversation(id);
    const chatbotStatus = getChatbotStatus(conversation);

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
            <section className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
                                CRM Delplata
                            </p>
                            <h1 className="mt-2 truncate text-2xl font-semibold text-slate-950">
                                {conversation.contact.name}
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">
                                {conversation.contact.phone ?? "Telefone não informado"}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:items-end">
                            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide sm:justify-end">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                                    {conversation.channel}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                                    {conversation.status}
                                </span>
                                <span className={`rounded-full border px-3 py-2 ${chatbotStatus.tone}`}>
                                    {chatbotStatus.label}
                                </span>
                            </div>

                            <ChatbotToggle
                                chatbotEnabled={conversation.chatbotEnabled}
                                conversationId={conversation.id}
                            />
                        </div>
                    </div>
                </div>

                <div className="px-5 py-5 sm:px-6">
                    <MessageList
                        initialMessages={conversation.messages}
                        conversationId={conversation.id}
                    />

                    <ReplyBox conversationId={conversation.id} />
                </div>
            </section>
        </main>
    );
}
