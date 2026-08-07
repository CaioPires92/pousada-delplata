import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/admin-auth";

const ALLOWED_AUDIENCES = new Set(["public", "verified_guest", "staff", "admin"]);

async function authorize() {
    const auth = await requireAdminAuth();
    return auth instanceof NextResponse ? { response: auth } : { auth };
}

// GET: Listar todas as regras
export async function GET() {
    try {
        const authorization = await authorize();
        if (authorization.response) return authorization.response;
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
        const authorization = await authorize();
        if (authorization.response) return authorization.response;
        const body = await req.json();
        const { trigger, response, category, audience = "public", source } = body;

        if (!trigger || !response || typeof source !== "string" || !source.trim() || !ALLOWED_AUDIENCES.has(audience)) {
            return NextResponse.json({ ok: false, error: "Gatilho, resposta, público e fonte são obrigatórios" }, { status: 400 });
        }

        const newRule = await prisma.chatbotRule.create({
            data: {
                trigger,
                response,
                category: category || "faq",
                audience,
                source: source.trim(),
                approvedAt: new Date(),
                approvedBy: authorization.auth.adminId,
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
        const authorization = await authorize();
        if (authorization.response) return authorization.response;
        const body = await req.json();
        const { id, trigger, response, category, audience, source, isActive } = body;

        if (!id) return NextResponse.json({ ok: false, error: "ID é obrigatório" }, { status: 400 });
        if (audience !== undefined && !ALLOWED_AUDIENCES.has(audience)) {
            return NextResponse.json({ ok: false, error: "Público inválido" }, { status: 400 });
        }
        const changesKnowledge = [trigger, response, category, audience, source]
            .some(value => value !== undefined);

        const updatedRule = await prisma.chatbotRule.update({
            where: { id },
            data: {
                trigger,
                response,
                category,
                audience,
                source,
                ...(changesKnowledge ? {
                    version: { increment: 1 },
                    approvedAt: new Date(),
                    approvedBy: authorization.auth.adminId,
                } : {}),
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
        const authorization = await authorize();
        if (authorization.response) return authorization.response;
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
