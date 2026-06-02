import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  default: {
    pipelineCard: { findMany: vi.fn() },
    internalActionLog: { groupBy: vi.fn() },
  },
}));

describe("POST /api/crm/segments/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = "test-token";
    vi.mocked(prisma.pipelineCard.findMany).mockResolvedValue([] as any);
  });

  it("requires token", async () => {
    const req = new Request("http://localhost/api/crm/segments/preview", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns preview payload", async () => {
    const req = new Request("http://localhost/api/crm/segments/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      body: JSON.stringify({ stage: "QUALIFICANDO" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
  });
});
