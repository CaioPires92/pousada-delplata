import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: Listar notas
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const notes = await prisma.internalNote.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: "desc" }
        });
        return NextResponse.json({ ok: true, notes });
    } catch (error) {
        return NextResponse.json({ ok: false, error: "Erro ao buscar notas" }, { status: 500 });
    }
}

// POST: Criar nota
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { content } = body;

        if (!content) {
            return NextResponse.json({ ok: false, error: "Conteúdo é obrigatório" }, { status: 400 });
        }

        const note = await prisma.internalNote.create({
            data: {
                conversationId: id,
                content
            }
        });

        return NextResponse.json({ ok: true, note });
    } catch (error) {
        return NextResponse.json({ ok: false, error: "Erro ao criar nota" }, { status: 500 });
    }
}
