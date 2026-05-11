import prisma from "@/lib/prisma";
import { isConversationAutomationActive } from "@/lib/crm/automationPause";
import { sendEvolutionText } from "./evolution";

export async function matchRule(text: string): Promise<string | null> {
    if (!text) return null;

    const normalizedInput = text.toLowerCase().trim();
    
    // Buscar regras ativas
    const rules = await prisma.chatbotRule.findMany({
        where: { isActive: true }
    });

    // Busca exata ou por inclusão simples
    const matchedRule = rules.find(rule => 
        normalizedInput === rule.trigger.toLowerCase().trim() ||
        normalizedInput.includes(rule.trigger.toLowerCase().trim())
    );

    return matchedRule ? matchedRule.response : null;
}

export async function processAutoResponse(conversationId: string, phone: string, text: string) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
            chatbotEnabled: true,
            automationPausedUntil: true,
        },
    });

    if (!isConversationAutomationActive(conversation)) {
        return null;
    }

    const responseText = await matchRule(text);
    
    if (!responseText) return null;

    // Enviar via Evolution API
    const evolutionResponse = await sendEvolutionText({
        number: phone,
        text: responseText
    });

    // Registrar no banco de dados
    const now = new Date();
    await prisma.message.create({
        data: {
            conversationId,
            senderType: "bot",
            content: responseText,
            messageType: "text",
            sentAt: now,
            metadataJson: JSON.stringify(evolutionResponse)
        }
    });

    // Atualizar timestamp da conversa
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now }
    });

    return responseText;
}
