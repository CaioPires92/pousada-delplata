import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PIPELINE_STAGES, PIPELINE_TERMINAL_STAGE_VALUES } from "@/lib/crm/pipelineStages";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, phone, email, source, estimatedValue, intendedArrival } = body;

        // Validação básica
        if (!name || (!phone && !email)) {
            return NextResponse.json(
                { ok: false, error: "Nome e pelo menos um contato (telefone ou e-mail) são obrigatórios" },
                { status: 400 }
            );
        }

        // Validação de valor
        const parsedValue = estimatedValue ? parseFloat(estimatedValue) : null;
        if (estimatedValue && isNaN(parsedValue as number)) {
            return NextResponse.json({ ok: false, error: "Valor estimado inválido" }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Resolver Contato (Upsert manual para garantir atomicidade)
            let contact = await tx.contact.findFirst({
                where: {
                    OR: [
                        phone ? { phone: phone } : undefined,
                        email ? { email: email } : undefined,
                    ].filter(Boolean) as any,
                },
            });

            if (!contact) {
                contact = await tx.contact.create({
                    data: {
                        name,
                        phoneRaw: phone,
                        phone: phone,
                        email,
                        source: source || "manual",
                    },
                });
            }

            // 2. Verificar se já existe um card ATIVO no pipeline para este contato
            // Isso evita "inundar" o Kanban com o mesmo lead várias vezes
            const activeCard = await tx.pipelineCard.findFirst({
                where: {
                    contactId: contact.id,
                    NOT: {
                        stage: { in: [...PIPELINE_TERMINAL_STAGE_VALUES] }
                    }
                }
            });

            if (activeCard) {
                return {
                    ok: true,
                    contact,
                    pipelineCard: activeCard,
                    message: "Este contato já possui um card ativo no pipeline."
                };
            }

            // 3. Garantir Conversa
            let conversation = await tx.conversation.findFirst({
                where: { contactId: contact.id, status: "open" },
            });

            if (!conversation) {
                conversation = await tx.conversation.create({
                    data: {
                        contactId: contact.id,
                        channel: "whatsapp",
                        status: "open",
                    },
                });
            }

            // 4. Criar Card
            const pipelineCard = await tx.pipelineCard.create({
                data: {
                    contactId: contact.id,
                    conversationId: conversation.id,
                    stage: PIPELINE_STAGES.NOVO_LEAD,
                    source: source || "manual",
                    estimatedValue: parsedValue,
                    intendedArrival: intendedArrival ? new Date(intendedArrival) : null,
                },
            });

            return { ok: true, contact, conversation, pipelineCard };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Erro no Hardening de lead manual:", error);
        return NextResponse.json(
            { ok: false, error: "Erro interno ao processar lead. Verifique se os dados já existem." },
            { status: 500 }
        );
    }
}
