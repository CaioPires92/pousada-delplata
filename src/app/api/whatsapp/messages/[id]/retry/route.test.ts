import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";

const mocks = vi.hoisted(() => ({
    requireAdminAuth: vi.fn(),
    send: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
    requireAdminAuth: mocks.requireAdminAuth,
}));

vi.mock("@/lib/messaging/provider-factory", () => ({
    createMessagingProvider: () => ({
        name: "evolution",
        normalizeWebhook: vi.fn(),
        send: mocks.send,
    }),
}));

import { POST } from "./route";

async function cleanup() {
    const contacts = await prisma.contact.findMany({
        where: { source: "test-whatsapp-retry" },
        select: { id: true },
    });
    const contactIds = contacts.map(contact => contact.id);
    if (contactIds.length === 0) return;

    await prisma.internalActionLog.deleteMany({ where: { contactId: { in: contactIds } } });
    await prisma.automationQueueJob.deleteMany({
        where: { conversation: { contactId: { in: contactIds } } },
    });
    await prisma.conversation.deleteMany({ where: { contactId: { in: contactIds } } });
    await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
}

async function failedMessage() {
    const contact = await prisma.contact.create({
        data: {
            name: "Teste reenvio",
            phone: "551188880099",
            source: "test-whatsapp-retry",
        },
    });
    const conversation = await prisma.conversation.create({
        data: { contactId: contact.id, channel: "whatsapp", status: "open" },
    });
    const message = await prisma.message.create({
        data: {
            conversationId: conversation.id,
            senderType: "human",
            content: "Tentar novamente",
            messageType: "text",
            deliveryStatus: "failed",
            deliveryErrorCode: "request_failed",
            deliveryErrorTitle: "Falha ao enviar",
            deliveryUpdatedAt: new Date(),
            sentAt: new Date(),
        },
    });

    return { contact, conversation, message };
}

function retry(messageId: string) {
    return POST(new Request(`http://localhost/api/whatsapp/messages/${messageId}/retry`, {
        method: "POST",
    }), { params: Promise.resolve({ id: messageId }) });
}

describe("safe WhatsApp message retry", () => {
    beforeEach(async () => {
        mocks.send.mockReset();
        mocks.requireAdminAuth.mockResolvedValue({
            adminId: "admin-1",
            email: "recepcao@delplata.com.br",
            role: "admin",
        });
        await cleanup();
    });

    afterEach(cleanup);

    it("claims a failed message once and prevents a second concurrent send", async () => {
        const { conversation, message } = await failedMessage();
        let releaseProvider!: () => void;
        mocks.send.mockImplementation(() => new Promise(resolve => {
            releaseProvider = () => resolve({
                externalMessageId: "EVO_RETRY_SAFE_001",
                acceptedAt: "2026-08-06T14:00:00.000Z",
                status: "sent",
            });
        }));

        const firstRequest = retry(message.id);
        await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());

        const secondResponse = await retry(message.id);
        expect(secondResponse.status).toBe(409);
        await expect(secondResponse.json()).resolves.toEqual({
            ok: false,
            error: "message_not_retryable",
        });

        releaseProvider();
        const firstResponse = await firstRequest;
        expect(firstResponse.status).toBe(200);
        expect(mocks.send).toHaveBeenCalledOnce();

        const [updatedMessage, updatedConversation, auditLog] = await Promise.all([
            prisma.message.findUnique({ where: { id: message.id } }),
            prisma.conversation.findUnique({ where: { id: conversation.id } }),
            prisma.internalActionLog.findFirst({
                where: { conversationId: conversation.id, action: "WhatsAppRetryStarted" },
            }),
        ]);
        expect(updatedMessage).toMatchObject({
            externalMessageId: "EVO_RETRY_SAFE_001",
            deliveryStatus: "sent",
            deliveryErrorCode: null,
            deliveryErrorTitle: null,
        });
        expect(updatedConversation?.assignedUserId).toBe("admin-1");
        expect(updatedConversation?.automationPausedUntil).not.toBeNull();
        expect(auditLog?.metadataJson).toContain('"actorId":"admin-1"');
    });

    it("returns a failed claim to failed state when the provider rejects it", async () => {
        const { message } = await failedMessage();
        mocks.send.mockRejectedValue(Object.assign(new Error("provider unavailable"), {
            code: "request_failed",
        }));

        const response = await retry(message.id);
        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({
            ok: false,
            error: "messaging_retry_failed",
        });

        const updatedMessage = await prisma.message.findUnique({ where: { id: message.id } });
        expect(updatedMessage).toMatchObject({
            deliveryStatus: "failed",
            deliveryErrorCode: "request_failed",
            deliveryErrorTitle: "Falha ao reenviar",
        });
        expect(updatedMessage?.deliveryErrorDetail).toBeNull();
    });

    it("rejects a message that is no longer failed", async () => {
        const { message } = await failedMessage();
        await prisma.message.update({
            where: { id: message.id },
            data: { deliveryStatus: "delivered" },
        });

        const response = await retry(message.id);
        expect(response.status).toBe(409);
        expect(mocks.send).not.toHaveBeenCalled();
    });
});
