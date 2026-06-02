import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  default: {
    pipelineCard: { findMany: vi.fn() },
    internalActionLog: { count: vi.fn() },
    message: { create: vi.fn() },
    conversation: { update: vi.fn() },
  },
}));

vi.mock("@/lib/whatsapp/evolution", () => ({
  resolveEvolutionSendTarget: vi.fn().mockReturnValue("5511999999999@s.whatsapp.net"),
  sendEvolutionTextWithRetry: vi.fn().mockResolvedValue({ id: "ev-1" }),
}));

vi.mock("@/lib/crm/events", () => ({
  recordCrmEvent: vi.fn().mockResolvedValue(null),
}));

describe("POST /api/crm/followup/lost-leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = "test-token";
    vi.mocked(prisma.pipelineCard.findMany).mockResolvedValue([] as any);
  });

  it("rejects without token", async () => {
    const req = new Request("http://localhost/api/crm/followup/lost-leads", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns summary in dry-run", async () => {
    const req = new Request("http://localhost/api/crm/followup/lost-leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ dryRun: true }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.dryRun).toBe(true);
  });
});
