import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export async function GET() {
    try {
        const conversations = await prisma.conversation.findMany({
            orderBy: { lastMessageAt: "desc" },
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
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        content: true,
                        createdAt: true,
                    },
                },
            },
        });

        return NextResponse.json(
            conversations.map((c) => ({
                id: c.id,
                name: c.contact?.name || "Sem nome",
                phone: c.contact?.phone || null,
                lid: c.contact?.lid || null,
                lastMessage: c.messages[0]?.content || null,
                lastMessageAt: c.lastMessageAt,
                unreadCount: c.unreadCount,
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