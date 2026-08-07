import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  requireAdminAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    chatbotRule: {
      create: mocks.create,
      findMany: mocks.findMany,
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdminAuth: mocks.requireAdminAuth,
}));

import { GET, POST } from "./route";

describe("admin chatbot rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
    mocks.findMany.mockResolvedValue([]);
  });

  it("rejects unauthenticated access", async () => {
    mocks.requireAdminAuth.mockResolvedValue(
      NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    );

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("creates a public rule as approved by the authenticated administrator", async () => {
    mocks.create.mockImplementation(async ({ data }) => ({ id: "rule-1", ...data }));
    const response = await POST(new Request("http://localhost/api/admin/chatbot/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger: "estacionamento",
        response: "O estacionamento é gratuito.",
        source: "Confirmado pela administração",
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        audience: "public",
        approvedAt: expect.any(Date),
        approvedBy: "admin-1",
        source: "Confirmado pela administração",
      }),
    });
  });

  it("rejects unsupported audiences", async () => {
    const response = await POST(new Request("http://localhost/api/admin/chatbot/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "segredo", response: "não", audience: "everyone" }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
