import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/crm/events", () => ({
  recordCrmEvent: vi.fn(),
}));

describe("POST /api/crm/site-leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordCrmEvent).mockResolvedValue(null as any);
  });

  it("validates required contact identity", async () => {
    const req = new Request("http://localhost/api/crm/site-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Lead sem contato" }),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "invalid_body" });
  });

  it("returns ids and handoff data", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      return fn({
        contact: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "contact-1", phone: "5511999999999" }),
        },
        conversation: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "conv-1" }),
          update: vi.fn().mockResolvedValue({ id: "conv-1" }),
        },
        message: {
          create: vi.fn().mockResolvedValue({ id: "msg-1" }),
        },
        pipelineCard: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "card-1" }),
        },
      });
    });

    const req = new Request("http://localhost/api/crm/site-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Joao", phone: "(11) 99999-9999", source: "site_form" }),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body).toMatchObject({
      contactId: "contact-1",
      conversationId: "conv-1",
      pipelineCardId: "card-1",
      handoff: { whatsappPhone: "5511999999999" },
    });
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "SiteLeadCaptured" }));
  });
});
