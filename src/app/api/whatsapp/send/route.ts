import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEvolutionText } from "@/lib/whatsapp/evolution";

/**
 * Endpoint para envio manual de mensagens via CRM.
 * POST /api/whatsapp/send
 * Body: { conversationId: string, text: string }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);

        if (!body || !body.conversationId || !body.text) {
            return NextResponse.json(
                { ok: false, error: "invalid_body" },
                { status: 400 }
            );
        }

        const { conversationId, text } = body;

        // 2. Buscar Conversation pelo id, incluindo Contact.
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
        });

        // 3. Se não encontrar conversa, retornar 404.
        if (!conversation) {
            return NextResponse.json(
                { ok: false, error: "conversation_not_found" },
                { status: 404 }
            );
        }

        // 4. Se contato não tiver phoneNormalized, retornar 400.
        if (!conversation.contact.phoneNormalized) {
            return NextResponse.json(
                { ok: false, error: "missing_normalized_phone" },
                { status: 400 }
            );
        }

        // 5. Enviar mensagem pela Evolution API usando phoneNormalized.
        let evolutionResponse;
        try {
            evolutionResponse = await sendEvolutionText({
                number: conversation.contact.phoneNormalized,
                text: text,
            });
        } catch (error) {
            console.error("Erro ao enviar mensagem via Evolution:", error);
            return NextResponse.json(
                { ok: false, error: "evolution_send_failed" },
                { status: 502 }
            );
        }

        // Extrair ID externo se disponível (comum em evolution: data.key.id)
        const externalMessageId = evolutionResponse?.key?.id || null;
        const now = new Date();
        const automationPausedUntil = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutos

        // 6. Criar Message e 7. Atualizar Conversation dentro de uma transação.
        const result = await prisma.$transaction(async (tx) => {
            const message = await tx.message.create({
                data: {
                    conversationId: conversation.id,
                    externalMessageId,
                    senderType: "human",
                    content: text,
                    messageType: "text",
                    metadataJson: JSON.stringify(evolutionResponse),
                    sentAt: now,
                },
            });

            await tx.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: now,
                    automationPausedUntil,
                },
            });

            return message;
        });

        // 9. Retornar resposta de sucesso.
        return NextResponse.json({
            ok: true,
            messageId: result.id,
            conversationId: conversation.id,
        });
    } catch (error) {
        console.error("Erro interno no envio de mensagem:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
