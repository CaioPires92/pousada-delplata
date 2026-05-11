import { describe, expect, it } from "vitest";

import { mergePolledMessages, type InboxMessage } from "./messagePolling";

function message(overrides: Partial<InboxMessage>): InboxMessage {
    return {
        id: "msg-1",
        senderType: "guest",
        content: "Oi",
        messageType: "text",
        createdAt: "2026-05-10T12:00:00.000Z",
        sentAt: "2026-05-10T12:00:00.000Z",
        ...overrides,
    };
}

describe("mergePolledMessages", () => {
    it("keeps pending local messages that are not on the server yet", () => {
        const merged = mergePolledMessages(
            [message({ id: "temp-1", senderType: "human", content: "Olá", status: "pending" })],
            [message({ id: "server-1", content: "Oi" })]
        );

        expect(merged.map(item => item.id)).toEqual(["server-1", "temp-1"]);
    });

    it("removes optimistic local messages once the server returns the same message", () => {
        const merged = mergePolledMessages(
            [message({ id: "temp-1", senderType: "human", content: "Olá", status: "pending" })],
            [message({ id: "server-1", senderType: "human", content: "Olá", createdAt: "2026-05-10T12:00:20.000Z", sentAt: "2026-05-10T12:00:20.000Z" })]
        );

        expect(merged.map(item => item.id)).toEqual(["server-1"]);
    });

    it("keeps errored local messages visible", () => {
        const merged = mergePolledMessages(
            [message({ id: "temp-error", senderType: "human", content: "Falhou", status: "error" })],
            []
        );

        expect(merged).toHaveLength(1);
        expect(merged[0].status).toBe("error");
    });
});
