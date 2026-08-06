import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import InternalNotesPanel from "./InternalNotesPanel";

describe("InternalNotesPanel", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("keeps notes behind a separate panel and saves only through the internal notes route", async () => {
        const fetchMock = vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
            if (init?.method === "POST") {
                return Promise.resolve({
                    ok: true,
                    json: vi.fn().mockResolvedValue({
                        ok: true,
                        note: {
                            id: "note-2",
                            authorId: "admin-1",
                            content: "Cliente prefere quarto silencioso",
                            createdAt: "2026-08-06T15:05:00.000Z",
                            updatedAt: "2026-08-06T15:05:00.000Z",
                        },
                    }),
                });
            }

            return Promise.resolve({
                ok: true,
                json: vi.fn().mockResolvedValue({
                    ok: true,
                    notes: [{
                        id: "note-1",
                        authorId: "admin-1",
                        content: "Contato realizado por telefone",
                        createdAt: "2026-08-06T15:00:00.000Z",
                        updatedAt: "2026-08-06T15:00:00.000Z",
                    }],
                }),
            });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<InternalNotesPanel conversationId="conversation-1" />);
        expect(screen.queryByLabelText("Notas internas da conversa")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Notas internas" }));
        expect(await screen.findByText("Contato realizado por telefone")).toBeInTheDocument();
        expect(screen.getByText("Visível apenas para a equipe. Não é enviada ao hóspede.")).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText("Escreva uma observação sobre este atendimento..."), {
            target: { value: "Cliente prefere quarto silencioso" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Adicionar nota" }));

        expect(await screen.findByText("Cliente prefere quarto silencioso")).toBeInTheDocument();
        const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
        expect(postCall?.[0]).toBe("/api/crm/conversations/conversation-1/notes");
        expect(postCall?.[1]).toMatchObject({
            method: "POST",
            body: JSON.stringify({ content: "Cliente prefere quarto silencioso" }),
        });
        await waitFor(() => expect(screen.getByPlaceholderText("Escreva uma observação sobre este atendimento...")).toHaveValue(""));
        expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/api/whatsapp"))).toBe(false);
    });
});
