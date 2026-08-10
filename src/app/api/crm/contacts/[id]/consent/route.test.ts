import { beforeEach, describe, expect, it, vi } from "vitest";

import { setWhatsappConsent } from "@/lib/crm/whatsappConsent";
import { PATCH } from "./route";

vi.mock("@/lib/crm/whatsappConsent", () => ({
  setWhatsappConsent: vi.fn(),
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
    vi.mocked(setWhatsappConsent).mockResolvedValue({
      contact: { id: "c1", optInWhatsapp: true, optOutAt: null },
      cancelledJobs: 0,
    });

    const req = new Request("http://localhost/api/crm/contacts/c1/consent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
      body: JSON.stringify({ optInWhatsapp: true, origin: "landing" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "c1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(setWhatsappConsent).toHaveBeenCalledWith({
      contactId: "c1",
      optInWhatsapp: true,
      origin: "human_api",
      sourceOrigin: "landing",
    });
  });
});
