import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { PATCH } from "./route";

vi.mock("@/lib/prisma", () => ({
  default: {
    contact: { update: vi.fn() },
  },
}));

vi.mock("@/lib/crm/events", () => ({
  recordCrmEvent: vi.fn().mockResolvedValue(null),
}));

describe("PATCH /api/crm/contacts/[id]/consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRM_INTERNAL_API_TOKEN = "test-token";
  });

  it("requires token", async () => {
    const req = new Request("http://localhost/api/crm/contacts/c1/consent", { method: "PATCH" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(401);
  });

  it("updates consent", async () => {
    vi.mocked(prisma.contact.update).mockResolvedValue({ id: "c1", optInWhatsapp: true, optOutAt: null } as any);

    const req = new Request("http://localhost/api/crm/contacts/c1/consent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      body: JSON.stringify({ optInWhatsapp: true, origin: "landing" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "c1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ContactConsentUpdated" }));
  });
});
