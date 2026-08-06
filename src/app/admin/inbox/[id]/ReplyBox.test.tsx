import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

import ReplyBox from "./ReplyBox";

describe("ReplyBox failed message persistence", () => {
    beforeEach(() => {
        mocks.refresh.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("replaces the optimistic id with the persisted failed message id", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue({
                error: "messaging_send_failed",
                messageId: "persisted-failure-1",
            }),
        }));
        const messageErrors: Array<Record<string, string>> = [];
        const listener = (event: Event) => {
            messageErrors.push((event as CustomEvent<Record<string, string>>).detail);
        };
        window.addEventListener("crm-message-error", listener);

        render(<ReplyBox conversationId="conversation-1" />);
        fireEvent.change(screen.getByPlaceholderText("Digite sua resposta aqui..."), {
            target: { value: "Mensagem que falhou" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

        await waitFor(() => expect(messageErrors).toHaveLength(1));
        expect(messageErrors[0]).toMatchObject({
            conversationId: "conversation-1",
            persistedMessageId: "persisted-failure-1",
        });
        expect(messageErrors[0].messageId).toMatch(/^temp-/);
        expect(screen.getByText("messaging_send_failed")).toBeInTheDocument();

        window.removeEventListener("crm-message-error", listener);
    });
});
