import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdminAuth: vi.fn().mockResolvedValue({ adminId: "admin-1" }),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    followUpSettings: { upsert: vi.fn() },
    internalActionLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/crm/followUpCadence", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/crm/followUpCadence")>();
  return {
    ...original,
    getFollowUpCadenceSettings: vi.fn().mockResolvedValue({
      enabled: false,
      cadenceHours: [2, 24, 72],
      quietHoursStart: 20,
      quietHoursEnd: 8,
    }),
  };
});

import prisma from "@/lib/prisma";
import { GET, PUT } from "./route";

describe("follow-up cadence admin settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.followUpSettings.upsert).mockResolvedValue({
      id: "global",
      enabled: true,
      cadenceHoursJson: "[2,24,72]",
    } as never);
    vi.mocked(prisma.internalActionLog.create).mockResolvedValue({} as never);
  });

  it("returns the safe disabled default", async () => {
    const response = await GET();
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      settings: {
        enabled: false,
        cadenceHours: [2, 24, 72],
        quietHoursStart: 20,
        quietHoursEnd: 8,
      },
    });
  });

  it("persists a valid ordered cadence and its audit record", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/settings/follow-up-cadence", {
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        cadenceHours: [72, 2, 24],
        quietHoursStart: 21,
        quietHoursEnd: 7,
      }),
    }));

    expect(response.status).toBe(200);
    expect(prisma.followUpSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        enabled: true,
        cadenceHoursJson: "[2,24,72]",
        quietHoursStart: 21,
        quietHoursEnd: 7,
      },
    }));
    expect(prisma.internalActionLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "FollowUpCadenceUpdated", userId: "admin-1" }),
    }));
  });

  it("rejects duplicate or out-of-range cadence steps", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/settings/follow-up-cadence", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, cadenceHours: [2, 2, 1000] }),
    }));

    expect(response.status).toBe(400);
    expect(prisma.followUpSettings.upsert).not.toHaveBeenCalled();
  });
});
