import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminInboxPage from "./page";

describe("AdminInboxPage service indicators", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("shows the human queue, oldest wait and first response average", async () => {
        const waitingSince = new Date(Date.now() - 10 * 60_000).toISOString();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                items: [{
                    id: "conversation-1",
                    name: "Hóspede",
                    phone: "5511999999999",
                    lid: null,
                    lastMessage: "Preciso de ajuda",
                    lastMessageAt: waitingSince,
                    unreadCount: 1,
                    waitingSince,
                    firstResponseTimeSeconds: null,
                }],
                metrics: {
                    awaitingHumanCount: 2,
                    oldestWaitingSince: waitingSince,
                    averageFirstResponseSeconds: 95,
                },
                pageInfo: { hasMore: false, nextCursor: null },
            }),
        }));

        const { unmount } = render(<AdminInboxPage />);

        await waitFor(() => expect(screen.getByText("Hóspede")).toBeInTheDocument());
        expect(screen.getByText("Aguardando humano").nextElementSibling).toHaveTextContent("2");
        expect(screen.getByText("Maior espera atual").nextElementSibling).toHaveTextContent("10min");
        expect(screen.getByText("Média da 1ª resposta").nextElementSibling).toHaveTextContent("1min");
        expect(screen.getByText("Aguardando há 10min")).toBeInTheDocument();

        unmount();
    });
});
