import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/admin-auth", () => ({ requireAdminAuth: vi.fn() }));
vi.mock("@/lib/crm/bookingCheckout", () => ({ confirmBookingCheckout: vi.fn() }));

import { requireAdminAuth } from "@/lib/admin-auth";
import { confirmBookingCheckout } from "@/lib/crm/bookingCheckout";
import { POST } from "./route";

describe("POST /api/admin/bookings/[bookingId]/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminAuth).mockResolvedValue({ adminId: "admin-1" } as never);
  });

  it("requires an authenticated administrator", async () => {
    vi.mocked(requireAdminAuth).mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ bookingId: "booking-1" }) });
    expect(response.status).toBe(401);
    expect(confirmBookingCheckout).not.toHaveBeenCalled();
  });

  it("confirms checkout through the Booking domain service", async () => {
    vi.mocked(confirmBookingCheckout).mockResolvedValue({
      ok: true,
      newlyConfirmed: true,
      duplicate: false,
      checkoutConfirmedAt: new Date("2026-08-11T15:00:00.000Z"),
      postStay: {
        scheduled: true,
        jobId: "job-1",
        scheduledAt: new Date("2026-08-11T18:00:00.000Z"),
      },
      couponGrant: {
        created: true,
        reason: null,
        grant: { id: "grant-1" } as never,
      },
      couponIssue: {
        issued: true,
        reason: null,
        grant: { id: "grant-1" } as never,
        coupon: { id: "coupon-1" } as never,
        code: "VOLTE10-TESTE12345",
      },
    });
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ bookingId: "booking-1" }),
    });
    expect(response.status).toBe(200);
    expect(confirmBookingCheckout).toHaveBeenCalledWith({ bookingId: "booking-1" });
  });
});
