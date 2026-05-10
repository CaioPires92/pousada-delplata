import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type RouteParams = {
    params: Promise<{
        id: string;
    }>;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    return value as JsonRecord;
}

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        const conversation = await prisma.conversation.update({
            where: { id },
            data: {
                unreadCount: 0,
                lastReadAt: new Date(),
            },
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
                messages: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        id: true,
                        senderType: true,
                        content: true,
                        messageType: true,
                        mediaUrl: true,
                        createdAt: true,
                        sentAt: true,
                    },
                },
                pipelineCards: {
                    take: 1,
                    orderBy: { updatedAt: "desc" },
                    select: {
                        id: true,
                        stage: true,
                        estimatedValue: true,
                        intendedArrival: true,
                        bookingId: true,
                    }
                }
            },
        });

        if (!conversation) {
            return NextResponse.json(
                { ok: false, error: "conversation_not_found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            id: conversation.id,
            status: conversation.status,
            channel: conversation.channel,
            chatbotEnabled: conversation.chatbotEnabled,
            automationPausedUntil: conversation.automationPausedUntil,
            lastMessageAt: conversation.lastMessageAt,
            contact: {
                id: conversation.contact.id,
                name: conversation.contact.name || "Sem nome",
                phone: conversation.contact.phone,
            },
            pipelineCard: conversation.pipelineCards[0] || null,
            messages: conversation.messages,
        });
    } catch (error) {
        console.error("Erro ao buscar conversa:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => null);
        const bodyRecord = asRecord(body);

        if (typeof bodyRecord?.chatbotEnabled !== "boolean") {
            return NextResponse.json(
                { ok: false, error: "invalid_body" },
                { status: 400 }
            );
        }

        const existingConversation = await prisma.conversation.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existingConversation) {
            return NextResponse.json(
                { ok: false, error: "conversation_not_found" },
                { status: 404 }
            );
        }

        const conversation = await prisma.conversation.update({
            where: { id },
            data: {
                chatbotEnabled: bodyRecord.chatbotEnabled,
                automationPausedUntil: null,
            },
            select: {
                id: true,
                chatbotEnabled: true,
                automationPausedUntil: true,
            },
        });

        return NextResponse.json({
            ok: true,
            conversationId: conversation.id,
            chatbotEnabled: conversation.chatbotEnabled,
            automationPausedUntil: conversation.automationPausedUntil,
        });
    } catch (error) {
        console.error("Erro ao atualizar chatbot da conversa:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
