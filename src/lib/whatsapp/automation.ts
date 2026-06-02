import prisma from "@/lib/prisma";
import { isConversationAutomationActive } from "@/lib/crm/automationPause";
import { cacheSetNx } from "@/lib/crm/cacheStore";
import { recordCrmEvent } from "@/lib/crm/events";
import { PIPELINE_STAGES, PIPELINE_TERMINAL_STAGE_VALUES } from "@/lib/crm/pipelineStages";
import {
    parseFlowDataJson,
    promptForFlowStep,
    shouldExpireQuoteFlow,
    shouldSkipPromptRepeat,
} from "@/lib/crm/quoteFlow";
import { sendEvolutionTextWithRetry } from "./evolution";
import { POST as quotePost } from "@/app/api/crm/quote/route";
import { POST as internalActionsPost } from "@/app/api/crm/internal-actions/route";

function formatDateForGuest(dayKey: string) {
    const date = new Date(`${dayKey}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return dayKey;
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(date);
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
    }).format(value);
}

function buildQuoteReplyText(input: {
    checkin: string;
    checkout: string;
    nights: number;
    options: Array<{ roomTypeName: string; totalPrice: number; remainingUnits: number }>;
}) {
    const lines = [
        `Período: ${formatDateForGuest(input.checkin)} até ${formatDateForGuest(input.checkout)} (${input.nights} noite(s)).`,
        "Encontrei estas opções:",
    ];

    input.options.slice(0, 3).forEach((option, index) => {
        lines.push(`${index + 1}) ${option.roomTypeName}: ${formatCurrency(option.totalPrice)} (${option.remainingUnits} unidade(s) disponível(is))`);
    });

    lines.push("Se quiser, eu já te explico as condições de pagamento para avançarmos com a reserva.");
    return lines.join("\n");
}

function summarizeContextForAudit(messages: Array<{ senderType: string; content: string | null }>) {
    return messages
        .slice(-5)
        .map((m) => `${m.senderType}: ${(m.content || "").slice(0, 120)}`)
        .join(" | ");
}

async function runInternalAction(token: string, action: string, payload: Record<string, unknown>) {
    const request = new Request("http://localhost/api/crm/internal-actions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, payload }),
    });

    const response = await internalActionsPost(request);
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
}

const QUOTE_DEBOUNCE_LOCK_MS = 45 * 1000;

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
    const now = new Date();
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
            id: true,
            contactId: true,
            chatbotEnabled: true,
            automationPausedUntil: true,
            currentFlow: true,
            flowStep: true,
            flowDataJson: true,
            lastAutomationAt: true,
        },
    });

    if (!conversation) {
        return null;
    }

    if (!isConversationAutomationActive(conversation)) {
        return null;
    }

    const activeCard = await prisma.pipelineCard.findFirst({
        where: { conversationId },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            stage: true,
        },
    });

    if (activeCard?.stage === PIPELINE_STAGES.RESERVA_EM_ANDAMENTO) {
        const draft = await prisma.reservationDraft.findFirst({
            where: {
                conversationId,
                status: "in_progress",
            },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                guestName: true,
                guestCpf: true,
                guestEmail: true,
                paymentMethod: true,
            },
        });

        if (draft) {
            let prompt: string | null = null;
            if (!draft.guestName) prompt = "Para seguir com a reserva, me informa o nome completo do responsável, por favor.";
            else if (!draft.guestCpf) prompt = "Perfeito. Agora me informa o CPF do responsável pela reserva.";
            else if (!draft.guestEmail) prompt = "Ótimo. Pode me passar também o e-mail para envio dos dados da reserva?";
            else if (!draft.paymentMethod) prompt = "Qual forma de pagamento você prefere (PIX, cartão ou transferência)?";

            if (prompt) {
                const evolutionResponse = await sendEvolutionTextWithRetry({ number: phone, text: prompt });
                await prisma.$transaction(async tx => {
                    await tx.message.create({
                        data: {
                            conversationId,
                            senderType: "bot",
                            content: prompt!,
                            messageType: "text",
                            sentAt: now,
                            metadataJson: JSON.stringify(evolutionResponse),
                        },
                    });

                    await tx.conversation.update({
                        where: { id: conversationId },
                        data: {
                            lastAutomationAt: now,
                            lastMessageAt: now,
                        },
                    });
                });

                await recordCrmEvent({
                    action: "ReservationDraftFieldRequested",
                    contactId: conversation.contactId,
                    conversationId: conversation.id,
                    metadata: {
                        draftId: draft.id,
                        requestedField:
                            !draft.guestName ? "guestName" :
                            !draft.guestCpf ? "guestCpf" :
                            !draft.guestEmail ? "guestEmail" :
                            "paymentMethod",
                    },
                });

                return prompt;
            }
        }
    }

    if (conversation?.currentFlow === "quote") {
        const recentContext = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { sentAt: "asc" },
            take: 5,
            select: {
                senderType: true,
                content: true,
            },
        });
        const flowData = parseFlowDataJson(conversation.flowDataJson);

        if (shouldExpireQuoteFlow(conversation.lastAutomationAt, now)) {
            await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    currentFlow: null,
                    flowStep: null,
                    flowDataJson: null,
                },
            });

            await recordCrmEvent({
                action: "QuoteFlowTimedOut",
                contactId: conversation.contactId,
                conversationId: conversation.id,
                metadata: {
                    previousStep: conversation.flowStep,
                },
            });

            return null;
        }

        if (conversation.flowStep === "ready_to_quote") {
            const token = process.env.CRM_INTERNAL_API_TOKEN;
            const checkin = flowData.checkin;
            const checkout = flowData.checkout;
            const adults = flowData.adults;
            const children = flowData.children ?? 0;
            const childrenAges = Array.isArray(flowData.childrenAges) ? flowData.childrenAges : [];
            const lockUntil = flowData.quoteLockUntil ? new Date(flowData.quoteLockUntil) : null;

            if (!token || !checkin || !checkout || !adults) {
                return null;
            }

            if (lockUntil && !Number.isNaN(lockUntil.getTime()) && lockUntil > now) {
                await recordCrmEvent({
                    action: "QuoteDebounced",
                    contactId: conversation.contactId,
                    conversationId: conversation.id,
                    metadata: {
                        reason: "active_lock",
                        lockUntil: lockUntil.toISOString(),
                    },
                });
                return null;
            }

            const volatileLock = await cacheSetNx(`crm:quote:lock:${conversationId}`, String(now.getTime()), Math.ceil(QUOTE_DEBOUNCE_LOCK_MS / 1000));
            if (!volatileLock) {
                await recordCrmEvent({
                    action: "QuoteDebounced",
                    contactId: conversation.contactId,
                    conversationId: conversation.id,
                    metadata: {
                        reason: "cache_lock",
                    },
                });
                return null;
            }

            const acquiredLock = await prisma.conversation.updateMany({
                where: {
                    id: conversationId,
                    OR: [
                        { lastAutomationAt: null },
                        { lastAutomationAt: { lt: new Date(now.getTime() - QUOTE_DEBOUNCE_LOCK_MS) } },
                    ],
                },
                data: {
                    lastAutomationAt: now,
                    flowDataJson: JSON.stringify({
                        ...flowData,
                        quoteLockUntil: new Date(now.getTime() + QUOTE_DEBOUNCE_LOCK_MS).toISOString(),
                    }),
                },
            });

            if (acquiredLock.count === 0) {
                await recordCrmEvent({
                    action: "QuoteDebounced",
                    contactId: conversation.contactId,
                    conversationId: conversation.id,
                    metadata: {
                        reason: "concurrent_execution",
                    },
                });
                return null;
            }

            const quoteRequest = new Request("http://localhost/api/crm/quote", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    conversationId,
                    checkin,
                    checkout,
                    adults,
                    children,
                    childrenAges,
                }),
            });

            const quoteResponse = await quotePost(quoteRequest);
            const quoteBody = await quoteResponse.json().catch(() => null) as any;

            if (!quoteResponse.ok || !quoteBody?.quote?.ok || !Array.isArray(quoteBody.quote.options) || quoteBody.quote.options.length === 0) {
                const fallbackText = quoteBody?.error === "min_stay_required"
                    ? `Para esse período, a estadia mínima é de ${quoteBody.minLos ?? "algumas"} noite(s). Se quiser, te ajudo a ajustar as datas.`
                    : "Não consegui encontrar disponibilidade nesse momento. Se quiser, me passe outras datas que eu consulto agora.";

                await runInternalAction(token, "SEND_WHATSAPP_MESSAGE", {
                    conversationId,
                    text: fallbackText,
                });

                await recordCrmEvent({
                    action: "QuoteFailed",
                    contactId: conversation.contactId,
                    conversationId: conversation.id,
                    metadata: {
                        checkin,
                        checkout,
                        adults,
                        children,
                        error: quoteBody?.error ?? "quote_unavailable",
                    },
                });

                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        flowStep: "waiting_checkin",
                        flowDataJson: JSON.stringify({}),
                        lastAutomationAt: new Date(),
                    },
                });
                return fallbackText;
            }

            const quote = quoteBody.quote;
            const quoteText = buildQuoteReplyText({
                checkin: quote.checkin,
                checkout: quote.checkout,
                nights: quote.nights,
                options: quote.options,
            });

            await recordCrmEvent({
                action: "ContextualResponseDecision",
                contactId: conversation.contactId,
                conversationId: conversation.id,
                metadata: {
                    decisionType: "quote_reply",
                    policySource: "availabilityQuoteApi",
                    contextSummary: summarizeContextForAudit(recentContext),
                    promptSummary: `period=${quote.checkin}->${quote.checkout}; options=${quote.options.length}; cheapest=${quote.options[0]?.totalPrice ?? null}`,
                },
            });

            const sendResult = await runInternalAction(token, "SEND_WHATSAPP_MESSAGE", {
                conversationId,
                text: quoteText,
            });

            const activeCard = await prisma.pipelineCard.findFirst({
                where: {
                    conversationId,
                    NOT: { stage: { in: [...PIPELINE_TERMINAL_STAGE_VALUES] } },
                },
                select: { id: true },
                orderBy: { updatedAt: "desc" },
            });

            if (activeCard) {
                await runInternalAction(token, "UPDATE_LEAD_FIELDS", {
                    pipelineCardId: activeCard.id,
                    intendedCheckin: checkin,
                    intendedCheckout: checkout,
                    adults,
                    children,
                });

                await runInternalAction(token, "MOVE_PIPELINE_CARD", {
                    pipelineCardId: activeCard.id,
                    toStage: PIPELINE_STAGES.ORCAMENTO_ENVIADO,
                    reason: "Orçamento enviado automaticamente via fluxo CRM",
                });
            }

            await recordCrmEvent({
                action: "QuoteSent",
                contactId: conversation.contactId,
                conversationId: conversation.id,
                metadata: {
                    checkin,
                    checkout,
                    adults,
                    children,
                    optionsCount: quote.options.length,
                    cheapestTotal: quote.options[0]?.totalPrice ?? null,
                    messageSent: sendResult.ok,
                },
            });

            await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    currentFlow: null,
                    flowStep: null,
                    flowDataJson: null,
                    lastAutomationAt: new Date(),
                },
            });

            return quoteText;
        }

        const prompt = promptForFlowStep(conversation.flowStep ?? "");
        if (prompt) {
            if (shouldSkipPromptRepeat(flowData, prompt.step, now)) {
                await recordCrmEvent({
                    action: "QuoteFlowPromptSkipped",
                    contactId: conversation.contactId,
                    conversationId: conversation.id,
                    metadata: {
                        reason: "repeat_debounce",
                        step: prompt.step,
                    },
                });
                return null;
            }

            const evolutionResponse = await sendEvolutionTextWithRetry({
                number: phone,
                text: prompt.text
            });

            await prisma.$transaction(async tx => {
                await tx.message.create({
                    data: {
                        conversationId,
                        senderType: "bot",
                        content: prompt.text,
                        messageType: "text",
                        sentAt: now,
                        metadataJson: JSON.stringify(evolutionResponse),
                    }
                });

                await tx.conversation.update({
                    where: { id: conversationId },
                    data: {
                        flowDataJson: JSON.stringify({
                            ...flowData,
                            lastPromptStep: prompt.step,
                            lastPromptAt: now.toISOString(),
                        }),
                        lastAutomationAt: now,
                        lastMessageAt: now,
                    }
                });
            });

            await recordCrmEvent({
                action: "QuoteFlowPromptSent",
                contactId: conversation.contactId,
                conversationId: conversation.id,
                metadata: {
                    step: prompt.step,
                    flow: "quote",
                },
            });

            return prompt.text;
        }
    }

    const responseText = await matchRule(text);
    
    if (!responseText) return null;

    // Enviar via Evolution API
    const evolutionResponse = await sendEvolutionTextWithRetry({
        number: phone,
        text: responseText
    });

    // Registrar no banco de dados
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
