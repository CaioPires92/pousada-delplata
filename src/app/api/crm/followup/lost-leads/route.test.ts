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
}));
vi.mock("@/lib/messaging/send-text", () => ({
  sendMessagingText: vi.fn().mockResolvedValue({ provider: "evolution", externalMessageId: "ev-1", acceptedAt: "2026-08-03T20:00:00.000Z", status: "sent" }),
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

  it("skips a lost lead that replied after the card was marked lost", async () => {
    vi.mocked(prisma.pipelineCard.findMany).mockResolvedValue([{
      id: "card-1",
      contactId: "contact-1",
      updatedAt: new Date("2026-08-01T10:00:00.000Z"),
      lossReason: "Sem retorno",
      lostReason: "Sem retorno",
      conversation: {
        id: "conversation-1",
        lastCustomerMessageAt: new Date("2026-08-01T11:00:00.000Z"),
        contact: { id: "contact-1", phone: "5511999999999" },
      },
    }] as never);

    const response = await POST(new Request("http://localhost/api/crm/followup/lost-leads", {
      method: "POST",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true }),
    }));

    await expect(response.json()).resolves.toMatchObject({
      sent: 0,
      skippedCustomerReplied: 1,
    });
    expect(prisma.internalActionLog.count).not.toHaveBeenCalled();
  });
});
