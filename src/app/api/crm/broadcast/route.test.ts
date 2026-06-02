import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  default: {
    pipelineCard: { findMany: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/crm/automationQueue", () => ({
  enqueueAutomationJob: vi.fn().mockResolvedValue({ id: "job-1" }),
}));

vi.mock("@/lib/crm/events", () => ({
  recordCrmEvent: vi.fn().mockResolvedValue(null),
}));

describe("POST /api/crm/broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = "test-token";
  });

  it("requires token", async () => {
    const req = new Request("http://localhost/api/crm/broadcast", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns preview in dryRun", async () => {
    vi.mocked(prisma.pipelineCard.findMany).mockResolvedValue([
      {
        id: "card-1",
        contactId: "contact-1",
        stage: "QUALIFICANDO",
        contact: { name: "Joao", phone: "5511999999999", phoneRaw: null, whatsappJid: null, optOutAt: null, optInWhatsapp: true },
      },
    ] as any);

    const req = new Request("http://localhost/api/crm/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ dryRun: true, text: "Olá" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.recipients).toBe(1);
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "BroadcastPreviewGenerated" }));
  });
});
