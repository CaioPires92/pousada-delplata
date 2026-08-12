import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

import ReplyBox from "./ReplyBox";

describe("ReplyBox", () => {
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

        render(<ReplyBox conversationId="conversation-1" automationMode="off" />);
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

    it("requires the attendant to use and send a supervised suggestion", async () => {
        const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
            if (!options?.method) {
                return {
                    ok: true,
                    json: async () => ({
                        ok: true,
                        suggestion: {
                            id: "suggestion-1",
                            content: "O check-in começa às 14h.",
                            intent: "checkin_info",
                        },
                    }),
                };
            }
            return { ok: true, json: async () => ({ ok: true, messageId: "message-1" }) };
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<ReplyBox conversationId="conversation-1" automationMode="supervised" />);
        expect(await screen.findByText("O check-in começa às 14h.")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Digite sua resposta aqui...")).toHaveValue("");

        fireEvent.click(screen.getByRole("button", { name: "Usar sugestão" }));
        expect(screen.getByPlaceholderText("Digite sua resposta aqui...")).toHaveValue("O check-in começa às 14h.");
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
            conversationId: "conversation-1",
            text: "O check-in começa às 14h.",
            suggestionId: "suggestion-1",
        });
    });

    it("removes a stale suggestion and asks the attendant to review the newest message", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ok: true, suggestion: { id: "suggestion-1", content: "A senha é pousada151.", intent: "faq" } }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 409,
                json: async () => ({ ok: false, error: "stale_supervised_suggestion" }),
            });
        vi.stubGlobal("fetch", fetchMock);

        render(<ReplyBox conversationId="conversation-1" automationMode="supervised" />);
        expect(await screen.findByText("A senha é pousada151.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Usar sugestão" }));
        fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

        expect(await screen.findByText("O hóspede enviou uma nova mensagem. Revise a conversa antes de responder.")).toBeInTheDocument();
        expect(screen.queryByText("Sugestão supervisionada · faq")).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText("Digite sua resposta aqui...")).toHaveValue("A senha é pousada151.");
    });
});
