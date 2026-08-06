import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildAuditMetadata } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";
import { inferPresenceFromLastGuestMessage } from "@/lib/crm/presence";
import { isAutomationMode, resolveAutomationMode } from "@/lib/crm/automationPause";
import { requireAdminAuth } from "@/lib/admin-auth";
import { cancelPendingAutomationJobs } from "@/lib/crm/automationQueue";

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

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        const { id } = await params;

        const conversation = await prisma.conversation.update({
            where: { id },
            data: {
                unreadCount: 0,
                lastReadAt: new Date(),
            },
            include: {
                contact: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
                messages: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        id: true,
                        senderType: true,
                        content: true,
                        messageType: true,
                        mediaUrl: true,
                        deliveryStatus: true,
                        deliveryErrorTitle: true,
                        deliveryErrorDetail: true,
                        deliveryUpdatedAt: true,
                        createdAt: true,
                        sentAt: true,
                    },
                },
                pipelineCards: {
                    take: 1,
                    orderBy: { updatedAt: "desc" },
                    select: {
                        id: true,
                        stage: true,
                        estimatedValue: true,
                        intendedArrival: true,
                        intendedCheckin: true,
                        intendedCheckout: true,
                        adults: true,
                        children: true,
                        roomTypeInterest: true,
                        lossReason: true,
                        lostReason: true,
                        bookingId: true,
                    }
                }
            },
        });

        if (!conversation) {
            return NextResponse.json(
                { ok: false, error: "conversation_not_found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            id: conversation.id,
            status: conversation.status,
            channel: conversation.channel,
            chatbotEnabled: conversation.chatbotEnabled,
            automationMode: resolveAutomationMode(conversation),
            automationPausedUntil: conversation.automationPausedUntil,
            lastMessageAt: conversation.lastMessageAt,
            contact: {
                id: conversation.contact.id,
                name: conversation.contact.name || "Sem nome",
                phone: conversation.contact.phone,
            },
            pipelineCard: conversation.pipelineCards[0] || null,
            presence: inferPresenceFromLastGuestMessage(
                [...conversation.messages]
                    .reverse()
                    .find(message => message.senderType === "guest")?.sentAt ?? null
            ),
            messages: conversation.messages,
            chatbotTestEnabled: conversation.chatbotTestEnabled,
        });
    } catch (error) {
        console.error("Erro ao buscar conversa:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;
        const body = await request.json().catch(() => null);
        const bodyRecord = asRecord(body);

        const requestedMode = isAutomationMode(bodyRecord?.automationMode)
            ? bodyRecord.automationMode
            : typeof bodyRecord?.chatbotEnabled === "boolean"
                ? bodyRecord.chatbotEnabled ? "auto" : "off"
                : null;
        const requestedTestEnabled = typeof bodyRecord?.chatbotTestEnabled === "boolean"
            ? bodyRecord.chatbotTestEnabled
            : null;

        if (!requestedMode && requestedTestEnabled === null) {
            return NextResponse.json(
                { ok: false, error: "invalid_body" },
                { status: 400 }
            );
        }

        const existingConversation = await prisma.conversation.findUnique({
            where: { id },
            select: {
                id: true,
                contactId: true,
                chatbotEnabled: true,
                automationMode: true,
                automationPausedUntil: true,
                chatbotTestEnabled: true,
            },
        });

        if (!existingConversation) {
            return NextResponse.json(
                { ok: false, error: "conversation_not_found" },
                { status: 404 }
            );
        }

        const effectiveMode = requestedTestEnabled === true ? "auto" : requestedMode;
        const disablesTestOverride = requestedMode !== null && requestedMode !== "auto";
        const nextTestEnabled = requestedTestEnabled
            ?? (disablesTestOverride ? false : existingConversation.chatbotTestEnabled);

        const { conversation, cancelledJobs } = await prisma.$transaction(async (tx) => {
            const updatedConversation = await tx.conversation.update({
                where: { id },
                data: {
                    ...(effectiveMode ? {
                        automationMode: effectiveMode,
                        chatbotEnabled: effectiveMode === "auto",
                        automationPausedUntil: null,
                        assignedUserId: effectiveMode === "auto" ? null : auth.adminId,
                    } : {}),
                    ...(requestedTestEnabled !== null || disablesTestOverride
                        ? { chatbotTestEnabled: nextTestEnabled }
                        : {}),
                },
                select: {
                    id: true,
                    chatbotEnabled: true,
                    automationMode: true,
                    automationPausedUntil: true,
                    assignedUserId: true,
                    chatbotTestEnabled: true,
                },
            });
            const cancelledCount = !effectiveMode || effectiveMode === "auto"
                ? 0
                : await cancelPendingAutomationJobs({
                    conversationId: id,
                    reason: `conversation_mode_${effectiveMode}`,
                    client: tx,
                });

            return { conversation: updatedConversation, cancelledJobs: cancelledCount };
        });

        await recordCrmEvent({
            action: requestedTestEnabled !== null
                ? requestedTestEnabled ? "ChatbotTestEnabled" : "ChatbotTestDisabled"
                : effectiveMode === "off"
                ? "HumanTookOver"
                : effectiveMode === "auto"
                    ? "AutomationResumed"
                    : "AutomationModeChanged",
            contactId: existingConversation.contactId,
            conversationId: conversation.id,
            userId: auth.adminId,
            metadata: {
                ...buildAuditMetadata({
                    actorType: "human",
                    origin: "admin_ui",
                    actorId: auth.adminId,
                }),
                chatbotEnabled: conversation.chatbotEnabled,
                previousMode: resolveAutomationMode(existingConversation),
                automationMode: conversation.automationMode,
                assignedUserId: conversation.assignedUserId,
                chatbotTestEnabled: conversation.chatbotTestEnabled,
                previousChatbotTestEnabled: existingConversation.chatbotTestEnabled,
                cancelledJobs,
                pauseStrategy: effectiveMode === "off" ? "indefinite" : "none",
                pauseMinutes: null,
            },
        });

        return NextResponse.json({
            ok: true,
            conversationId: conversation.id,
            chatbotEnabled: conversation.chatbotEnabled,
            automationMode: conversation.automationMode,
            automationPausedUntil: conversation.automationPausedUntil,
            assignedUserId: conversation.assignedUserId,
            chatbotTestEnabled: conversation.chatbotTestEnabled,
            cancelledJobs,
        });
    } catch (error) {
        console.error("Erro ao atualizar chatbot da conversa:", error);
        return NextResponse.json(
            { ok: false, error: "internal_error" },
            { status: 500 }
        );
    }
}
