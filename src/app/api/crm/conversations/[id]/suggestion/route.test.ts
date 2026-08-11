import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/prisma", () => ({
  default: { supervisedReplySuggestion: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}));

import { GET, PATCH } from "./route";

const params = { params: Promise.resolve({ id: "conversation-1" }) };

describe("supervised suggestion API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
  });

  it("requires an authenticated attendant", async () => {
    mocks.requireAdminAuth.mockResolvedValue(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    await expect(GET(new Request("http://localhost"), params)).resolves.toMatchObject({ status: 401 });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns only the latest pending suggestion for the conversation", async () => {
    mocks.findFirst.mockResolvedValue({ id: "suggestion-1", content: "Resposta" });
    const response = await GET(new Request("http://localhost"), params);
    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversationId: "conversation-1", status: "pending" },
    }));
  });

  it("dismisses only a pending suggestion from the same conversation", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ suggestionId: "suggestion-1", action: "dismiss" }),
    }), params);
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "suggestion-1", conversationId: "conversation-1", status: "pending" },
      data: expect.objectContaining({ reviewedBy: "admin-1" }),
    }));
  });
});
