import { NextResponse } from "next/server";

import { requireAdminAuth } from "@/lib/admin-auth";
import { cancelPendingAutomationJobs } from "@/lib/crm/automationQueue";
import {
    createAutomationPausedUntil,
    DEFAULT_AUTOMATION_PAUSE_MINUTES,
} from "@/lib/crm/automationPause";
import { buildAuditMetadata } from "@/lib/crm/audit";
import prisma from "@/lib/prisma";
import { createMessagingProvider } from "@/lib/messaging/provider-factory";
import { resolveEvolutionSendTarget } from "@/lib/whatsapp/evolution";

type RouteParams = {
    params: Promise<{ id: string }>;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as JsonRecord
        : undefined;
}

function safeErrorCode(error: unknown): string {
    const code = asRecord(error)?.code;
    return typeof code === "string" && code.trim() ? code.trim().slice(0, 100) : "unknown_error";
}

export async function POST(_request: Request, { params }: RouteParams) {
    try {
        const auth = await requireAdminAuth();
        if (auth instanceof NextResponse) return auth;

        const { id } = await params;
        const message = await prisma.message.findUnique({
            where: { id },
            select: {
                id: true,
                conversationId: true,
                externalMessageId: true,
                senderType: true,
                content: true,
                messageType: true,
                deliveryStatus: true,
                conversation: {
                    select: {
                        contactId: true,
                        contact: {
                            select: {
                                phone: true,
                                phoneRaw: true,
                                whatsappJid: true,
                            },
                        },
                    },
                },
            },
        });

        if (!message) {
            return NextResponse.json({ ok: false, error: "message_not_found" }, { status: 404 });
        }
        if (
            (message.senderType !== "human" && message.senderType !== "bot")
            || message.messageType !== "text"
            || !message.content?.trim()
        ) {
            return NextResponse.json({ ok: false, error: "message_not_retryable" }, { status: 400 });
        }

        const target = resolveEvolutionSendTarget(message.conversation.contact);
        if (!target) {
            return NextResponse.json({ ok: false, error: "missing_whatsapp_target" }, { status: 400 });
        }

        const now = new Date();
        const automationPausedUntil = createAutomationPausedUntil(now);
        const claimed = await prisma.$transaction(async (tx) => {
            const claim = await tx.message.updateMany({
                where: { id: message.id, deliveryStatus: "failed" },
                data: {
                    deliveryStatus: "retrying",
                    deliveryErrorCode: null,
                    deliveryErrorTitle: null,
                    deliveryErrorDetail: null,
                    deliveryUpdatedAt: now,
                },
            });
            if (claim.count === 0) return false;

            await tx.conversation.update({
                where: { id: message.conversationId },
                data: {
                    automationPausedUntil,
                    assignedUserId: auth.adminId,
                },
            });
            const cancelledJobs = await cancelPendingAutomationJobs({
                conversationId: message.conversationId,
                reason: "human_message_retry",
                now,
                client: tx,
            });
            await tx.internalActionLog.create({
                data: {
                    action: "WhatsAppRetryStarted",
                    contactId: message.conversation.contactId,
                    conversationId: message.conversationId,
                    metadataJson: JSON.stringify({
                        messageId: message.id,
                        cancelledJobs,
                        pauseMinutes: DEFAULT_AUTOMATION_PAUSE_MINUTES,
                        pausedUntil: automationPausedUntil.toISOString(),
                        ...buildAuditMetadata({
                            actorType: "human",
                            origin: "admin_ui",
                            actorId: auth.adminId,
                        }),
                    }),
                },
            });

            return true;
        });

        if (!claimed) {
            return NextResponse.json({ ok: false, error: "message_not_retryable" }, { status: 409 });
        }

        const provider = createMessagingProvider();
        try {
            const sendResult = await provider.send({
                kind: "text",
                recipientId: target,
                text: message.content,
            });
            const updated = await prisma.message.updateMany({
                where: { id: message.id, deliveryStatus: "retrying" },
                data: {
                    externalMessageId: sendResult.externalMessageId,
                    deliveryStatus: "sent",
                    deliveryUpdatedAt: new Date(sendResult.acceptedAt),
                    metadataJson: JSON.stringify({
                        provider: provider.name,
                        retriedFromExternalMessageId: message.externalMessageId,
                        retryAcceptedAt: sendResult.acceptedAt,
                    }),
                },
            });
            if (updated.count === 0) {
                throw Object.assign(new Error("retry_claim_lost"), { code: "retry_claim_lost" });
            }

            return NextResponse.json({
                ok: true,
                messageId: message.id,
                externalMessageId: sendResult.externalMessageId,
                deliveryStatus: "sent",
            });
        } catch (error) {
            const errorCode = safeErrorCode(error);
            await prisma.message.updateMany({
                where: { id: message.id, deliveryStatus: "retrying" },
                data: {
                    deliveryStatus: "failed",
                    deliveryErrorCode: errorCode,
                    deliveryErrorTitle: "Falha ao reenviar",
                    deliveryErrorDetail: null,
                    deliveryUpdatedAt: new Date(),
                },
            });
            await prisma.internalActionLog.create({
                data: {
                    action: "WhatsAppRetryFailed",
                    contactId: message.conversation.contactId,
                    conversationId: message.conversationId,
                    metadataJson: JSON.stringify({
                        messageId: message.id,
                        errorCode,
                        ...buildAuditMetadata({
                            actorType: "human",
                            origin: "admin_ui",
                            actorId: auth.adminId,
                        }),
                    }),
                },
            });
            return NextResponse.json({ ok: false, error: "messaging_retry_failed" }, { status: 502 });
        }
    } catch (error) {
        console.error("Erro interno ao reenviar mensagem:", error);
        return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
    }
}
