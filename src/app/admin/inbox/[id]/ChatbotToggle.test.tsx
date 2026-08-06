import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatbotToggle from './ChatbotToggle';

const routerMocks = vi.hoisted(() => ({
    refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: routerMocks.refresh }),
}));

describe('ChatbotToggle', () => {
    beforeEach(() => {
        routerMocks.refresh.mockClear();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ ok: true }),
        }));
    });

    it('assumes the conversation without sending a WhatsApp message', async () => {
        render(<ChatbotToggle automationMode="auto" conversationId="conversation-1" chatbotTestEnabled />);

        fireEvent.click(screen.getByRole('button', { name: 'Assumir Conversa' }));

        await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledOnce());
        expect(fetch).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledWith('/api/crm/conversations/conversation-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ automationMode: 'off' }),
        });
        expect(fetch).not.toHaveBeenCalledWith('/api/whatsapp/send', expect.anything());
    });

    it('changes to supervised mode without authorizing automatic replies', async () => {
        render(<ChatbotToggle automationMode="off" conversationId="conversation-1" chatbotTestEnabled={false} />);

        fireEvent.click(screen.getByRole('button', { name: 'Supervisionado' }));

        await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledOnce());
        expect(fetch).toHaveBeenCalledWith('/api/crm/conversations/conversation-1', expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ automationMode: 'supervised' }),
        }));
    });

    it('enables the test exception only for the current conversation', async () => {
        render(<ChatbotToggle automationMode="off" conversationId="conversation-1" chatbotTestEnabled={false} />);

        fireEvent.click(screen.getByRole('button', { name: 'Ativar bot só nesta conversa' }));

        await waitFor(() => expect(routerMocks.refresh).toHaveBeenCalledOnce());
        expect(fetch).toHaveBeenCalledWith('/api/crm/conversations/conversation-1', expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ chatbotTestEnabled: true }),
        }));
    });
});
