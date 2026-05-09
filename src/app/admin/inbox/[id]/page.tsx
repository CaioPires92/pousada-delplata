
import { headers } from "next/headers";
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
    contact: {
        name: string;
        phone: string | null;
    };
    messages: Message[];
};

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

    return (
        <main className="min-h-screen bg-slate-100 p-6">
            <section className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-6 border-b pb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                        CRM Delplata
                    </p>
                    <h1 className="mt-2 text-3xl font-bold">Conversa</h1>
                    <p className="mt-2 text-slate-600">
                        {conversation.contact.name} · {conversation.contact.phone}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                        Canal: {conversation.channel} · Status: {conversation.status} ·
                        Chatbot: {conversation.chatbotEnabled ? " ligado" : " desligado"}
                    </p>
                </div>

                <MessageList 
                    initialMessages={conversation.messages} 
                    conversationId={conversation.id} 
                />
                
                <ReplyBox conversationId={conversation.id} />
            </section>
        </main>
    );
}