import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/prisma", () => ({
  default: { supervisedReplySuggestion: { findMany: mocks.findMany, updateMany: mocks.updateMany } },
}));

import { GET, PATCH } from "./route";

describe("admin supervised suggestion queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
    mocks.findMany.mockResolvedValue([]);
  });

  it("returns a bounded queue of pending suggestions", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "suggestion-1",
      conversationId: "conversation-1",
      content: "O check-in começa às 14h.",
      intent: "checkin_info",
      createdAt: new Date("2026-08-12T12:00:00.000Z"),
      conversation: { contact: { name: "Hóspede teste", phone: "5519999999999" } },
    }]);

    const response = await GET();
    const body = await response.json();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "pending" },
      take: 25,
    }));
    expect(body.suggestions[0]).toMatchObject({
      id: "suggestion-1",
      conversationId: "conversation-1",
      contactLabel: "Hóspede teste",
    });
  });

  it("dismisses only a pending suggestion and audits the reviewer", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const response = await PATCH(new Request("http://localhost/api/admin/chatbot/suggestions", {
      method: "PATCH",
      body: JSON.stringify({ suggestionId: "suggestion-1" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "suggestion-1", status: "pending" },
      data: expect.objectContaining({ status: "dismissed", reviewedBy: "admin-1" }),
    }));
  });

  it("requires authentication", async () => {
    mocks.requireAdminAuth.mockResolvedValue(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
