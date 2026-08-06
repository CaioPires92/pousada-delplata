import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MessageList from './MessageList';

type EventSourceMessage = { data: string };

class EventSourceMock {
    static instances: EventSourceMock[] = [];

    readonly url: string;
    onmessage: ((event: EventSourceMessage) => void) | null = null;
    onerror: (() => void) | null = null;
    close = vi.fn();

    constructor(url: string) {
        this.url = url;
        EventSourceMock.instances.push(this);
    }
}

const initialMessage = {
    id: 'message-1',
    senderType: 'guest',
    content: 'Mensagem inicial',
    messageType: 'text',
    createdAt: '2026-08-05T12:00:00.000Z',
    sentAt: '2026-08-05T12:00:00.000Z',
};

describe('MessageList realtime updates', () => {
    beforeEach(() => {
        EventSourceMock.instances = [];
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: vi.fn(),
        });
        vi.stubGlobal('EventSource', EventSourceMock);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ messages: [initialMessage] }),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('receives SSE snapshots without duplicating messages and keeps native reconnection enabled', async () => {
        const { unmount } = render(
            <MessageList initialMessages={[initialMessage]} conversationId="conversation-1" />
        );
        const source = EventSourceMock.instances[0];

        expect(source.url).toBe('/api/crm/conversations/conversation-1/stream?intervalMs=3000');

        const incomingMessage = {
            ...initialMessage,
            id: 'message-2',
            content: 'Nova mensagem',
            createdAt: '2026-08-05T12:01:00.000Z',
            sentAt: '2026-08-05T12:01:00.000Z',
        };
        const snapshot = JSON.stringify({
            ok: true,
            messages: [initialMessage, incomingMessage],
        });

        act(() => source.onmessage?.({ data: snapshot }));
        act(() => source.onmessage?.({ data: snapshot }));

        await waitFor(() => expect(screen.getAllByText('Nova mensagem')).toHaveLength(1));

        act(() => source.onerror?.());
        expect(source.close).not.toHaveBeenCalled();

        unmount();
        expect(source.close).toHaveBeenCalledOnce();
    });

    it('shows sent, delivered, read and failed states for outbound messages', async () => {
        const statusMessages = [
            { ...initialMessage, id: 'sent', senderType: 'human', deliveryStatus: 'sent' as const },
            { ...initialMessage, id: 'delivered', senderType: 'human', deliveryStatus: 'delivered' as const },
            { ...initialMessage, id: 'read', senderType: 'bot', deliveryStatus: 'read' as const },
            {
                ...initialMessage,
                id: 'failed',
                senderType: 'human',
                deliveryStatus: 'failed' as const,
                deliveryErrorTitle: 'Número indisponível',
            },
        ];
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ messages: statusMessages }),
        } as unknown as Response);
        render(
            <MessageList
                conversationId="conversation-1"
                initialMessages={statusMessages}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Enviada')).toBeInTheDocument();
            expect(screen.getByLabelText('Entregue')).toBeInTheDocument();
            expect(screen.getByLabelText('Lida')).toBeInTheDocument();
            expect(screen.getByLabelText('Falha ao enviar')).toBeInTheDocument();
            expect(screen.getByText('Número indisponível. Tente novamente.')).toBeInTheDocument();
        });
    });

    it('updates a delivery state received through SSE', async () => {
        render(
            <MessageList
                initialMessages={[{ ...initialMessage, senderType: 'human', deliveryStatus: 'sent' }]}
                conversationId="conversation-1"
            />
        );
        const source = EventSourceMock.instances[0];

        expect(screen.getByLabelText('Enviada')).toBeInTheDocument();
        act(() => source.onmessage?.({
            data: JSON.stringify({
                ok: true,
                messages: [{ ...initialMessage, senderType: 'human', deliveryStatus: 'read' }],
            }),
        }));

        await waitFor(() => expect(screen.getByLabelText('Lida')).toBeInTheDocument());
        expect(screen.queryByLabelText('Enviada')).not.toBeInTheDocument();
    });
});
