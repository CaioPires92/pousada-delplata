import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ALLOWED_STAGES = new Set([
    "novo",
    "em_atendimento",
    "proposta",
    "fechado",
    "perdido",
]);

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

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => null);
        const bodyRecord = asRecord(body);

        if (typeof bodyRecord?.stage !== "string" || !ALLOWED_STAGES.has(bodyRecord.stage)) {
            return NextResponse.json(
                { ok: false, error: "invalid_body" },
                { status: 400 }
            );
        }

        const existingCard = await prisma.pipelineCard.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existingCard) {
            return NextResponse.json(
                { ok: false, error: "pipeline_card_not_found" },
                { status: 404 }
            );
        }

        const pipelineCard = await prisma.pipelineCard.update({
            where: { id },
            data: {
                stage: bodyRecord.stage,
                lastActivityAt: new Date(),
            },
            select: {
                id: true,
                stage: true,
                lastActivityAt: true,
            },
        });

        return NextResponse.json({
            ok: true,
            cardId: pipelineCard.id,
            stage: pipelineCard.stage,
            lastActivityAt: pipelineCard.lastActivityAt,
        });
    } catch (error) {
        console.error("Erro ao mover card do pipeline:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
