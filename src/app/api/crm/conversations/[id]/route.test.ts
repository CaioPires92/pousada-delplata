import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    update: vi.fn(),
    recordCrmEvent: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        conversation: {
            findUnique: mocks.findUnique,
            update: mocks.update,
        },
    },
}));

vi.mock('@/lib/crm/events', () => ({
    recordCrmEvent: mocks.recordCrmEvent,
}));

import { PATCH } from './route';

describe('conversation automation mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findUnique.mockResolvedValue({ id: 'conversation-1' });
        mocks.recordCrmEvent.mockResolvedValue(null);
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
            },
        }));
        await expect(response.json()).resolves.toEqual(expect.objectContaining({
            ok: true,
            automationMode,
            chatbotEnabled,
        }));
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
});
