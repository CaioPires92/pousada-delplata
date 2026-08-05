import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        conversation: {
            findUnique: prismaMocks.findUnique,
        },
    },
}));

import { GET } from './route';

describe('conversation SSE stream', () => {
    beforeEach(() => {
        prismaMocks.findUnique.mockReset();
    });

    it('returns an initial realtime snapshot and closes when the client disconnects', async () => {
        prismaMocks.findUnique.mockResolvedValue({
            id: 'conversation-1',
            updatedAt: new Date('2026-08-05T12:01:00.000Z'),
            lastMessageAt: new Date('2026-08-05T12:00:00.000Z'),
            messages: [{
                id: 'message-1',
                senderType: 'guest',
                content: 'Olá',
                messageType: 'text',
                mediaUrl: null,
                createdAt: new Date('2026-08-05T12:00:00.000Z'),
                sentAt: new Date('2026-08-05T12:00:00.000Z'),
            }],
        });
        const abortController = new AbortController();
        const request = new Request(
            'http://localhost/api/crm/conversations/conversation-1/stream?intervalMs=1000',
            { signal: abortController.signal }
        );

        const response = await GET(request, {
            params: Promise.resolve({ id: 'conversation-1' }),
        });

        expect(response.headers.get('content-type')).toBe('text/event-stream');
        expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');

        const reader = response.body?.getReader();
        expect(reader).toBeDefined();
        const firstChunk = await reader!.read();
        const payload = new TextDecoder().decode(firstChunk.value);

        expect(payload).toContain('data: ');
        expect(JSON.parse(payload.replace(/^data: /, '').trim())).toEqual({
            ok: true,
            conversationId: 'conversation-1',
            updatedAt: '2026-08-05T12:01:00.000Z',
            lastMessageAt: '2026-08-05T12:00:00.000Z',
            messages: [expect.objectContaining({ id: 'message-1', content: 'Olá' })],
        });

        abortController.abort();
        await expect(reader!.read()).resolves.toEqual({ done: true, value: undefined });
        expect(prismaMocks.findUnique).toHaveBeenCalledOnce();
    });
});
