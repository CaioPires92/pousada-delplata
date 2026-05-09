import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type RouteParams = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        const conversation = await prisma.conversation.findUnique({
            where: { id },
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phoneNormalized: true,
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
                phone: conversation.contact.phoneNormalized,
            },
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
