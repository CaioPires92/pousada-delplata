import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
    comparePipelineStages,
    normalizePipelineStage,
    PIPELINE_STAGE_ORDER,
} from "@/lib/crm/pipelineStages";

type PipelineCardResponse = {
    id: string;
    stage: string;
    priority: string;
    source: string;
    assignedUserId: string | null;
    lastActivityAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    estimatedValue: number | null;
    intendedArrival: Date | null;
    intendedCheckin: Date | null;
    intendedCheckout: Date | null;
    adults: number | null;
    children: number | null;
    roomTypeInterest: string | null;
    lossReason: string | null;
    lostReason: string | null;
    contact: {
        id: string;
        name: string;
        phone: string | null;
    };
    conversation: {
        id: string;
        status: string;
        channel: string;
        lastMessageAt: Date | null;
        lastMessage: string | null;
    } | null;
};

export async function GET() {
    try {
        const pipelineCards = await prisma.pipelineCard.findMany({
            orderBy: [
                { stage: "asc" },
                { lastActivityAt: "desc" },
                { updatedAt: "desc" },
            ],
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
                conversation: {
                    select: {
                        id: true,
                        status: true,
                        channel: true,
                        lastMessageAt: true,
                        messages: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            select: {
                                content: true,
                            },
                        },
                    },
                },
            },
        });

        const cards: PipelineCardResponse[] = pipelineCards.map((card) => ({
            id: card.id,
            stage: normalizePipelineStage(card.stage),
            priority: card.priority,
            source: card.source,
            assignedUserId: card.assignedUserId,
            lastActivityAt: card.lastActivityAt,
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            estimatedValue: card.estimatedValue,
            intendedArrival: card.intendedArrival,
            intendedCheckin: card.intendedCheckin,
            intendedCheckout: card.intendedCheckout,
            adults: card.adults,
            children: card.children,
            roomTypeInterest: card.roomTypeInterest,
            lossReason: card.lossReason,
            lostReason: card.lostReason,
            contact: {
                id: card.contact.id,
                name: card.contact.name || "Sem nome",
                phone: card.contact.phone,
            },
            conversation: card.conversation
                ? {
                    id: card.conversation.id,
                    status: card.conversation.status,
                    channel: card.conversation.channel,
                    lastMessageAt: card.conversation.lastMessageAt,
                    lastMessage: card.conversation.messages[0]?.content || null,
                }
                : null,
        }));

        const stageNames = Array.from(new Set([
            ...PIPELINE_STAGE_ORDER,
            ...cards.map((card) => card.stage),
        ])).sort(comparePipelineStages);

        const stages = stageNames.map((stage) => ({
            stage,
            cards: cards.filter((card) => card.stage === stage),
        }));

        return NextResponse.json({
            ok: true,
            stages,
        });
    } catch (error) {
        console.error("Erro ao listar pipeline do CRM:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
