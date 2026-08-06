import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAutomationPausedUntil, DEFAULT_AUTOMATION_PAUSE_MINUTES } from "@/lib/crm/automationPause";
import { buildAuditMetadata } from "@/lib/crm/audit";
import { recordCrmEvent } from "@/lib/crm/events";
import { createMessagingProvider } from "@/lib/messaging/provider-factory";
import { resolveEvolutionSendTarget } from "@/lib/whatsapp/evolution";
import { requireAdminAuth } from "@/lib/admin-auth";
import { cancelPendingAutomationJobs } from "@/lib/crm/automationQueue";

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
            sendResult = await provider.send({
                kind: "text",
                recipientId: target,
                text,
            });
        } catch (error) {
            console.error("Erro ao enviar mensagem via provider WhatsApp", {
                provider: process.env.WHATSAPP_PROVIDER || "evolution",
                errorCode: asRecord(error)?.code ?? "unknown_error",
            });
            await recordCrmEvent({
                action: "WhatsAppSendFailed",
                contactId: conversation.contactId,
                conversationId: conversation.id,
                metadata: {
                    target,
                    textLength: text.length,
                    provider: process.env.WHATSAPP_PROVIDER || "evolution",
                    errorCode: asRecord(error)?.code ?? "unknown_error",
                },
            });
            return NextResponse.json(
                { ok: false, error: "messaging_send_failed" },
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
                },
            });

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
