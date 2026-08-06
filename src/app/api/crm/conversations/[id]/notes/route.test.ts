import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
    requireAdminAuth: vi.fn(),
    conversationFindUnique: vi.fn(),
    noteFindMany: vi.fn(),
    noteCreate: vi.fn(),
    logCreate: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
    requireAdminAuth: mocks.requireAdminAuth,
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        conversation: { findUnique: mocks.conversationFindUnique },
        internalNote: { findMany: mocks.noteFindMany },
        $transaction: vi.fn(async (callback) => callback({
            internalNote: { create: mocks.noteCreate },
            internalActionLog: { create: mocks.logCreate },
        })),
    },
}));

import { GET, POST } from "./route";

const params = { params: Promise.resolve({ id: "conversation-1" }) };

describe("internal conversation notes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminAuth.mockResolvedValue({
            adminId: "admin-1",
            email: "recepcao@delplata.com.br",
            role: "admin",
        });
        mocks.conversationFindUnique.mockResolvedValue({
            id: "conversation-1",
            contactId: "contact-1",
        });
        mocks.noteFindMany.mockResolvedValue([]);
        mocks.noteCreate.mockResolvedValue({
            id: "note-1",
            authorId: "admin-1",
            content: "Observação interna",
            createdAt: new Date("2026-08-06T15:00:00.000Z"),
            updatedAt: new Date("2026-08-06T15:00:00.000Z"),
        });
        mocks.logCreate.mockResolvedValue({ id: "log-1" });
    });

    it("requires an authenticated administrator", async () => {
        mocks.requireAdminAuth.mockResolvedValue(
            NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        );

        const response = await GET(new Request("http://localhost/notes"), params);
        expect(response.status).toBe(401);
        expect(mocks.noteFindMany).not.toHaveBeenCalled();
    });

    it("stores a trimmed note with its author and audits without copying its content", async () => {
        const response = await POST(new Request("http://localhost/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "  Observação interna  " }),
        }), params);

        expect(response.status).toBe(201);
        expect(mocks.noteCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: {
                conversationId: "conversation-1",
                authorId: "admin-1",
                content: "Observação interna",
            },
        }));
        expect(mocks.logCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "InternalNoteCreated",
                contactId: "contact-1",
                conversationId: "conversation-1",
                metadataJson: expect.not.stringContaining("Observação interna"),
            }),
        });
    });

    it.each(["", " ", "x".repeat(2_001)])("rejects invalid note content", async (content) => {
        const response = await POST(new Request("http://localhost/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        }), params);

        expect(response.status).toBe(400);
        expect(mocks.noteCreate).not.toHaveBeenCalled();
    });
});
