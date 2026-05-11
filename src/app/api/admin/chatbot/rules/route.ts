import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: Listar todas as regras
export async function GET() {
    try {
        const rules = await prisma.chatbotRule.findMany({
            orderBy: { createdAt: "desc" }
        });
        return NextResponse.json({ ok: true, rules });
    } catch (error) {
        console.error("Erro ao listar regras:", error);
        return NextResponse.json({ ok: false, error: "Erro ao buscar regras" }, { status: 500 });
    }
}

// POST: Criar nova regra
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { trigger, response, category } = body;

        if (!trigger || !response) {
            return NextResponse.json({ ok: false, error: "Gatilho e resposta são obrigatórios" }, { status: 400 });
        }

        const newRule = await prisma.chatbotRule.create({
            data: {
                trigger,
                response,
                category: category || "faq",
                isActive: true
            }
        });

        return NextResponse.json({ ok: true, rule: newRule });
    } catch (error) {
        console.error("Erro ao criar regra:", error);
        return NextResponse.json({ ok: false, error: "Erro ao criar regra (verifique se o gatilho já existe)" }, { status: 500 });
    }
}

// PATCH: Atualizar regra existente
export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, trigger, response, category, isActive } = body;

        if (!id) return NextResponse.json({ ok: false, error: "ID é obrigatório" }, { status: 400 });

        const updatedRule = await prisma.chatbotRule.update({
            where: { id },
            data: {
                trigger,
                response,
                category,
                isActive
            }
        });

        return NextResponse.json({ ok: true, rule: updatedRule });
    } catch (error) {
        console.error("Erro ao atualizar regra:", error);
        return NextResponse.json({ ok: false, error: "Erro ao atualizar regra" }, { status: 500 });
    }
}

// DELETE: Remover regra
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ ok: false, error: "ID é obrigatório" }, { status: 400 });

        await prisma.chatbotRule.delete({
            where: { id }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Erro ao deletar regra:", error);
        return NextResponse.json({ ok: false, error: "Erro ao deletar regra" }, { status: 500 });
    }
}
