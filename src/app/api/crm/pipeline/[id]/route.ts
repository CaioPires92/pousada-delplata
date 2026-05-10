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

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => null);

        if (!body) {
            return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }

        const updateData: any = {
            lastActivityAt: new Date(),
        };

        if (body.stage) {
            if (!ALLOWED_STAGES.has(body.stage)) {
                return NextResponse.json({ ok: false, error: "invalid_stage" }, { status: 400 });
            }
            updateData.stage = body.stage;
        }

        if (body.estimatedValue !== undefined) updateData.estimatedValue = body.estimatedValue;
        if (body.intendedArrival !== undefined) updateData.intendedArrival = body.intendedArrival ? new Date(body.intendedArrival) : null;
        if (body.lossReason !== undefined) updateData.lossReason = body.lossReason;
        if (body.bookingId !== undefined) updateData.bookingId = body.bookingId;

        const pipelineCard = await prisma.pipelineCard.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            ok: true,
            card: pipelineCard,
        });
    } catch (error) {
        console.error("Erro ao atualizar card do pipeline:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
