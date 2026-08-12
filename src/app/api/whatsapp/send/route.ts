import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAutomationPausedUntil, DEFAULT_AUTOMATION_PAUSE_MINUTES } from "@/lib/crm/automationPause";
import { buildAuditMetadata } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";
import { createMessagingProvider } from "@/lib/messaging/provider-factory";
import { resolveEvolutionSendTarget } from "@/lib/whatsapp/evolution";
import { requireAdminAuth } from "@/lib/admin-auth";
import { cancelPendingAutomationJobs } from "@/lib/crm/automationQueue";
import { buildConversationResponseMetricUpdate } from "@/lib/crm/responseMetrics";
import { assertOutboundProviderPolicy } from "@/lib/messaging/outbound-policy";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    return value as JsonRecord;
}

function firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (typeof value !== "string") {
            continue;
        }

        const trimmed = value.trim();
        if (trimmed) {
            return trimmed;
        }
    }

    return undefined;
}

export async function POST(request: Request) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof NextResponse) return auth;

        const body = await request.json().catch(() => null);
        const bodyRecord = asRecord(body);
        const conversationId = firstString(bodyRecord?.conversationId);
        const text = firstString(bodyRecord?.text);
        const suggestionId = firstString(bodyRecord?.suggestionId);
        const actorId = auth.adminId;

        if (!conversationId || !text) {
            return NextResponse.json(
                { ok: false, error: "invalid_body" },
                { status: 400 }
            );
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                contact: {
                    select: {
                        phone: true,
                        phoneRaw: true,
                        whatsappJid: true,
                    },
                },
            },
        });

        if (!conversation) {
            return NextResponse.json(
                { ok: false, error: "conversation_not_found" },
                { status: 404 }
            );
        }

        const supervisedSuggestion = suggestionId
            ? await prisma.supervisedReplySuggestion.findFirst({
                where: {
                    id: suggestionId,
                    conversationId,
                    status: "pending",
                    content: text,
                },
                select: {
                    id: true,
                    sourceMessageId: true,
                    ruleId: true,
                    ruleVersion: true,
                    content: true,
                },
            })
            : null;
        if (suggestionId && !supervisedSuggestion) {
            return NextResponse.json(
                { ok: false, error: "invalid_supervised_suggestion" },
                { status: 400 }
            );
        }
        if (supervisedSuggestion) {
            const ruleIds = supervisedSuggestion.ruleId
                .split(",")
                .map(ruleId => ruleId.trim())
                .filter(Boolean);
            const currentRules = ruleIds.length > 0
                ? await prisma.chatbotRule.findMany({
                    where: {
                        id: { in: ruleIds },
                        isActive: true,
                        audience: "public",
                        approvedAt: { not: null },
                    },
                    select: { id: true, response: true, version: true },
                })
                : [];
            const rulesById = new Map(currentRules.map(rule => [rule.id, rule]));
            const orderedRules = ruleIds
                .map(ruleId => rulesById.get(ruleId))
                .filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));
            const currentContent = orderedRules.length === 1
                ? orderedRules[0].response
                : orderedRules.map((rule, index) => `${index + 1}. ${rule.response}`).join("\n\n");
            const currentVersion = orderedRules.length > 0
                ? Math.max(...orderedRules.map(rule => rule.version))
                : null;
            const ruleIsStale = orderedRules.length !== ruleIds.length
                || currentVersion !== supervisedSuggestion.ruleVersion
                || currentContent !== supervisedSuggestion.content;
            const sourceMessage = await prisma.message.findFirst({
                where: {
                    id: supervisedSuggestion.sourceMessageId,
                    conversationId,
                    senderType: "guest",
                },
                select: { sentAt: true },
            });
            const newerGuestMessage = sourceMessage
                ? await prisma.message.findFirst({
                    where: {
                        conversationId,
                        senderType: "guest",
                        id: { not: supervisedSuggestion.sourceMessageId },
                        sentAt: { gt: sourceMessage.sentAt },
                    },
                    select: { id: true },
                })
                : null;
            if (ruleIsStale || !sourceMessage || newerGuestMessage) {
                await prisma.supervisedReplySuggestion.update({
                    where: { id: supervisedSuggestion.id },
                    data: { status: "expired", reviewedBy: actorId, reviewedAt: new Date() },
                });
                return NextResponse.json(
                    { ok: false, error: "stale_supervised_suggestion" },
                    { status: 409 },
                );
            }
        }

        const target = resolveEvolutionSendTarget(conversation.contact);

        if (!target) {
            return NextResponse.json(
                { ok: false, error: "missing_whatsapp_target" },
                { status: 400 }
            );
        }

        const now = new Date();
        const automationPausedUntil = createAutomationPausedUntil(now);
        const cancelledJobs = await prisma.$transaction(async (tx) => {
            await tx.conversation.update({
                where: { id: conversation.id },
                data: {
                    automationPausedUntil,
                    assignedUserId: actorId,
                },
            });
            const cancelledCount = await cancelPendingAutomationJobs({
                conversationId: conversation.id,
                reason: "human_manual_message",
                now,
                client: tx,
            });
            const eventMetadata = {
                target,
                cancelledJobs: cancelledCount,
                pauseStrategy: "temporary",
                pauseMinutes: DEFAULT_AUTOMATION_PAUSE_MINUTES,
                pausedUntil: automationPausedUntil.toISOString(),
                ...buildAuditMetadata({
                    actorType: "human",
                    origin: "human_api",
                    actorId,
                }),
            };

            for (const action of ["HumanTookOver", "AutomationPaused"]) {
                await tx.internalActionLog.create({
                    data: {
                        action,
                        contactId: conversation.contactId,
                        conversationId: conversation.id,
                        metadataJson: JSON.stringify(eventMetadata),
                    },
                });
            }

            return cancelledCount;
        });

        let provider;
        let sendResult;
        try {
            provider = createMessagingProvider();
            const outboundMessage = {
                kind: "text" as const,
                recipientId: target,
                text,
            };
            const lastInbound = provider.name === "meta"
                ? await prisma.message.findFirst({
                    where: { conversationId: conversation.id, senderType: "guest" },
                    orderBy: { sentAt: "desc" },
                    select: { sentAt: true },
                })
                : null;
            assertOutboundProviderPolicy({
                provider: provider.name === "meta" ? "meta" : "evolution",
                message: outboundMessage,
                lastInboundAt: lastInbound?.sentAt,
                now,
            });
            sendResult = await provider.send(outboundMessage);
        } catch (error) {
            const providerName = process.env.WHATSAPP_PROVIDER || "evolution";
            const errorCode = firstString(asRecord(error)?.code) ?? "unknown_error";
            console.error("Erro ao enviar mensagem via provider WhatsApp", {
                provider: providerName,
                errorCode,
            });
            const failedMessage = await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderType: "human",
                    content: text,
                    messageType: "text",
                    deliveryStatus: "failed",
                    deliveryErrorCode: errorCode,
                    deliveryErrorTitle: "Falha ao enviar",
                    deliveryUpdatedAt: now,
                    metadataJson: JSON.stringify({ provider: providerName }),
                    sentAt: now,
                },
            });
            await recordCrmEvent({
                action: "WhatsAppSendFailed",
                contactId: conversation.contactId,
                conversationId: conversation.id,
                metadata: {
                    target,
                    textLength: text.length,
                    provider: providerName,
                    errorCode,
                    messageId: failedMessage.id,
                },
            });
            return NextResponse.json(
                { ok: false, error: "messaging_send_failed", messageId: failedMessage.id },
                { status: 502 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const message = await tx.message.create({
                data: {
                    conversationId: conversation.id,
                    externalMessageId: sendResult.externalMessageId,
                    senderType: "human",
                    content: text,
                    messageType: "text",
                    deliveryStatus: "sent",
                    deliveryUpdatedAt: new Date(sendResult.acceptedAt),
                    metadataJson: JSON.stringify({
                        provider: provider.name,
                        acceptedAt: sendResult.acceptedAt,
                        status: sendResult.status,
                    }),
                    sentAt: now,
                },
            });

            await tx.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: now,
                    ...buildConversationResponseMetricUpdate({
                        senderType: "human",
                        occurredAt: now,
                        state: conversation,
                    }),
                },
            });

            if (supervisedSuggestion) {
                await tx.supervisedReplySuggestion.update({
                    where: { id: supervisedSuggestion.id },
                    data: {
                        status: "approved",
                        reviewedBy: actorId,
                        reviewedAt: now,
                        sentMessageId: message.id,
                    },
                });
                await tx.internalActionLog.create({
                    data: {
                        action: "SupervisedReplyApproved",
                        contactId: conversation.contactId,
                        conversationId: conversation.id,
                        userId: actorId,
                        metadataJson: JSON.stringify({
                            suggestionId: supervisedSuggestion.id,
                            sentMessageId: message.id,
                            actionAuthorized: true,
                            ...buildAuditMetadata({ actorType: "human", origin: "admin_ui", actorId }),
                        }),
                    },
                });
            }

            return message;
        });

        return NextResponse.json({
            ok: true,
            messageId: result.id,
            conversationId: conversation.id,
            cancelledJobs,
        });
    } catch (error) {
        console.error("Erro interno no envio de mensagem:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
