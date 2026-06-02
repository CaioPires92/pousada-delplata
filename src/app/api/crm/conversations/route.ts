import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { inferPresenceFromLastGuestMessage } from "@/lib/crm/presence";
export async function GET() {
    try {
        const conversations = await prisma.conversation.findMany({
            orderBy: [
                { lastMessageAt: "desc" },
                { updatedAt: "desc" },
            ],
            take: 20,
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        lid: true,
                    },
                },
                messages: {
                    orderBy: [
                        { sentAt: "desc" },
                        { createdAt: "desc" },
                    ],
                    take: 1,
                    select: {
                        content: true,
                        sentAt: true,
                        createdAt: true,
                    },
                },
            },
        });

        const latestGuestByConversation = await Promise.all(
            conversations.map(async (conversation) => {
                const latestGuest = await prisma.message.findFirst({
                    where: {
                        conversationId: conversation.id,
                        senderType: "guest",
                    },
                    orderBy: [
                        { sentAt: "desc" },
                        { createdAt: "desc" },
                    ],
                    select: {
                        sentAt: true,
                        createdAt: true,
                    },
                });

                return {
                    conversationId: conversation.id,
                    lastGuestAt: latestGuest?.sentAt ?? latestGuest?.createdAt ?? null,
                };
            })
        );

        const latestGuestMap = new Map(
            latestGuestByConversation.map((item) => [item.conversationId, item.lastGuestAt])
        );

        return NextResponse.json(
            conversations.map((c) => ({
                id: c.id,
                name: c.contact?.name || "Sem nome",
                phone: c.contact?.phone || null,
                lid: c.contact?.lid || null,
                lastMessage: c.messages[0]?.content || null,
                lastMessageAt: c.lastMessageAt ?? c.messages[0]?.sentAt ?? c.messages[0]?.createdAt ?? null,
                unreadCount: c.unreadCount,
                presence: inferPresenceFromLastGuestMessage(latestGuestMap.get(c.id) ?? null),
            }))
        );
    } catch (error) {
        console.error("Erro ao listar conversas:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
