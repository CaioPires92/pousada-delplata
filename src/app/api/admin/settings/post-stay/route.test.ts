import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: vi.fn().mockResolvedValue({ adminId: "admin-1" }) }));
vi.mock("@/lib/prisma", () => ({
  default: {
    postStaySettings: { upsert: vi.fn() },
    internalActionLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/crm/postStaySettings", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/crm/postStaySettings")>();
  return {
    ...original,
    getPostStaySettings: vi.fn().mockResolvedValue({ officialReviewUrl: null, reviewConfigured: false }),
  };
});

import prisma from "@/lib/prisma";
import { GET, PUT } from "./route";

describe("post-stay admin settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.internalActionLog.create).mockResolvedValue({} as never);
  });

  it("returns an unconfigured safe default", async () => {
    const response = await GET();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      settings: { officialReviewUrl: null, reviewConfigured: false },
    });
  });

  it("persists an approved HTTPS URL without logging its value", async () => {
    vi.mocked(prisma.postStaySettings.upsert).mockResolvedValue({
      id: "global",
      officialReviewUrl: "https://example.com/review",
    } as never);
    const response = await PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ officialReviewUrl: "https://example.com/review" }),
    }));
    expect(response.status).toBe(200);
    expect(prisma.internalActionLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "PostStaySettingsUpdated",
        metadataJson: '{"actorType":"human","origin":"admin_ui","reviewConfigured":true}',
      }),
    }));
  });

  it("rejects an insecure review URL", async () => {
    const response = await PUT(new Request("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ officialReviewUrl: "http://example.com/review" }),
    }));
    expect(response.status).toBe(400);
    expect(prisma.postStaySettings.upsert).not.toHaveBeenCalled();
  });
});
