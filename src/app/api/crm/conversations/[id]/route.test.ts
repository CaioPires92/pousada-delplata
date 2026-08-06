import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    update: vi.fn(),
    updateManyJobs: vi.fn(),
    recordCrmEvent: vi.fn(),
    requireAdminAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        conversation: {
            findUnique: mocks.findUnique,
            update: mocks.update,
        },
        automationQueueJob: {
            updateMany: mocks.updateManyJobs,
        },
        $transaction: vi.fn(async (callback) => callback({
            conversation: { update: mocks.update },
            automationQueueJob: { updateMany: mocks.updateManyJobs },
        })),
    },
}));

vi.mock('@/lib/crm/events', () => ({
    recordCrmEvent: mocks.recordCrmEvent,
}));

vi.mock('@/lib/admin-auth', () => ({
    requireAdminAuth: mocks.requireAdminAuth,
}));

import { PATCH } from './route';

describe('conversation automation mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findUnique.mockResolvedValue({
            id: 'conversation-1',
            contactId: 'contact-1',
            chatbotEnabled: false,
            automationMode: 'off',
            automationPausedUntil: null,
            chatbotTestEnabled: false,
        });
        mocks.recordCrmEvent.mockResolvedValue(null);
        mocks.updateManyJobs.mockResolvedValue({ count: 2 });
        mocks.requireAdminAuth.mockResolvedValue({
            adminId: 'admin-1',
            email: 'recepcao@delplata.com.br',
            role: 'admin',
        });
    });

    it.each([
        ['off', false],
        ['supervised', false],
        ['auto', true],
    ] as const)('persists %s and keeps the legacy boolean synchronized', async (automationMode, chatbotEnabled) => {
        mocks.update.mockResolvedValue({
            id: 'conversation-1',
            automationMode,
            chatbotEnabled,
            automationPausedUntil: null,
            assignedUserId: automationMode === 'auto' ? null : 'admin-1',
            chatbotTestEnabled: false,
        });
        const request = new Request('http://localhost/api/crm/conversations/conversation-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ automationMode }),
        });

        const response = await PATCH(request, {
            params: Promise.resolve({ id: 'conversation-1' }),
        });

        expect(response.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'conversation-1' },
            data: {
                automationMode,
                chatbotEnabled,
                automationPausedUntil: null,
                assignedUserId: automationMode === 'auto' ? null : 'admin-1',
                ...(automationMode === 'auto' ? {} : { chatbotTestEnabled: false }),
            },
        }));
        await expect(response.json()).resolves.toEqual(expect.objectContaining({
            ok: true,
            automationMode,
            chatbotEnabled,
            assignedUserId: automationMode === 'auto' ? null : 'admin-1',
        }));
        expect(mocks.recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: automationMode === 'off'
                ? 'HumanTookOver'
                : automationMode === 'auto'
                    ? 'AutomationResumed'
                    : 'AutomationModeChanged',
            contactId: 'contact-1',
            userId: 'admin-1',
            metadata: expect.objectContaining({
                actorId: 'admin-1',
                automationMode,
                cancelledJobs: automationMode === 'auto' ? 0 : 2,
            }),
        }));
        if (automationMode === 'auto') {
            expect(mocks.updateManyJobs).not.toHaveBeenCalled();
        } else {
            expect(mocks.updateManyJobs).toHaveBeenCalledWith({
                where: {
                    conversationId: 'conversation-1',
                    action: 'SEND_WHATSAPP_MESSAGE',
                    status: 'pending',
                },
                data: expect.objectContaining({
                    status: 'cancelled',
                    cancelReason: `conversation_mode_${automationMode}`,
                }),
            });
        }
    });

    it('enables the chatbot only for this test conversation', async () => {
        mocks.update.mockResolvedValue({
            id: 'conversation-1',
            automationMode: 'auto',
            chatbotEnabled: true,
            automationPausedUntil: null,
            assignedUserId: null,
            chatbotTestEnabled: true,
        });
        const request = new Request('http://localhost/api/crm/conversations/conversation-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatbotTestEnabled: true }),
        });

        const response = await PATCH(request, {
            params: Promise.resolve({ id: 'conversation-1' }),
        });

        expect(response.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
            data: {
                automationMode: 'auto',
                chatbotEnabled: true,
                automationPausedUntil: null,
                assignedUserId: null,
                chatbotTestEnabled: true,
            },
        }));
        expect(mocks.recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({
            action: 'ChatbotTestEnabled',
            metadata: expect.objectContaining({ chatbotTestEnabled: true }),
        }));
        expect(mocks.updateManyJobs).not.toHaveBeenCalled();
    });

    it('rejects unknown modes', async () => {
        const request = new Request('http://localhost/api/crm/conversations/conversation-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ automationMode: 'wild' }),
        });

        const response = await PATCH(request, {
            params: Promise.resolve({ id: 'conversation-1' }),
        });

        expect(response.status).toBe(400);
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('rejects mode changes without an authenticated administrator', async () => {
        mocks.requireAdminAuth.mockResolvedValue(
            NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        );
        const request = new Request('http://localhost/api/crm/conversations/conversation-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ automationMode: 'off' }),
        });

        const response = await PATCH(request, {
            params: Promise.resolve({ id: 'conversation-1' }),
        });

        expect(response.status).toBe(401);
        expect(mocks.findUnique).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
