import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/crm/bookingKanbanReconciliation", () => ({
  reconcileBookingsWithKanban: vi.fn(),
}));

import { reconcileBookingsWithKanban } from "@/lib/crm/bookingKanbanReconciliation";
import { GET } from "./route";

describe("GET /api/cron/reconcile-crm-bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("NODE_ENV", "test");
    vi.mocked(reconcileBookingsWithKanban).mockResolvedValue({
      scanned: 2,
      linked: 1,
      stageUpdated: 1,
      unchanged: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("rejects an invalid cron token in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(new Request("http://localhost/api/cron/reconcile-crm-bookings", {
      headers: { authorization: "Bearer wrong" },
    }));

    expect(response.status).toBe(401);
    expect(reconcileBookingsWithKanban).not.toHaveBeenCalled();
  });

  it("fails closed when the production cron secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(new Request("http://localhost/api/cron/reconcile-crm-bookings", {
      headers: { authorization: "Bearer undefined" },
    }));

    expect(response.status).toBe(401);
    expect(reconcileBookingsWithKanban).not.toHaveBeenCalled();
  });

  it("returns the bounded reconciliation summary", async () => {
    const response = await GET(new Request("http://localhost/api/cron/reconcile-crm-bookings"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      scanned: 2,
      linked: 1,
      stageUpdated: 1,
    });
  });
});
