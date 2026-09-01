import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  bookingCount: vi.fn(),
  paymentFindMany: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdminAuth: mocks.requireAdminAuth,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      count: mocks.bookingCount,
    },
    payment: {
      findMany: mocks.paymentFindMany,
    },
  },
}));

import { GET } from "./route";

describe("admin stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ adminId: "admin-1" });
    mocks.bookingCount.mockResolvedValueOnce(12).mockResolvedValueOnce(3).mockResolvedValueOnce(7);
    mocks.paymentFindMany.mockResolvedValue([
      { amount: 100, provider: "  Stripe  ", method: "card", providerId: "abc" },
      { amount: 200, provider: "manual_test", method: "pix", providerId: " test_123 " },
      { amount: 300, provider: "MercadoPago", method: " MANUAL_TEST ", providerId: "mp-1" },
    ]);
  });

  it("returns aggregated stats and ignores manual test payments", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      totalBookings: 12,
      pendingBookings: 3,
      confirmedBookings: 7,
      totalRevenue: 100,
    });
    expect(mocks.paymentFindMany).toHaveBeenCalledWith({
      where: { status: "APPROVED" },
      select: { amount: true, provider: true, method: true, providerId: true },
    });
  });

  it("requires admin authentication", async () => {
    mocks.requireAdminAuth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.bookingCount).not.toHaveBeenCalled();
  });
});
