import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { couponGrant: { findUnique: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/coupons/code-vault", () => ({ decryptCouponCode: vi.fn(() => "VOLTE10-ABC1234567") }));
vi.mock("@/lib/crm/events", () => ({ recordCrmEvent: vi.fn() }));

import prisma from "@/lib/prisma";
import { recordCrmEvent } from "@/lib/crm/events";
import { buildTrackedCouponUrl } from "@/lib/coupons/booking-link";
import { GET } from "./route";

describe("GET /api/coupons/grants/[grantId]/click", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_JWT_SECRET = "test-secret";
    vi.mocked(prisma.couponGrant.findUnique).mockResolvedValue({
      id: "grant-1",
      bookingId: "booking-1",
      contactId: "contact-1",
      couponId: "coupon-1",
      redeemedAt: null,
      coupon: { active: true, endsAt: new Date(Date.now() + 60_000), codeCiphertext: "encrypted" },
    } as never);
    vi.mocked(prisma.couponGrant.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(recordCrmEvent).mockResolvedValue({ id: "event-1" } as never);
  });

  it("records the first click and redirects with the coupon pre-applied", async () => {
    const request = new Request(buildTrackedCouponUrl("grant-1", "https://pousadadelplata.com.br"));
    const response = await GET(request, { params: Promise.resolve({ grantId: "grant-1" }) });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/reservar?promo=VOLTE10-ABC1234567");
    expect(prisma.couponGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "grant-1", clickedAt: null },
      data: expect.objectContaining({ status: "CLICKED" }),
    }));
    expect(recordCrmEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "CouponClicked" }));
  });

  it("rejects a forged tracking token without reading the grant", async () => {
    const response = await GET(new Request("https://example.com/api/coupons/grants/grant-1/click?token=forged"), {
      params: Promise.resolve({ grantId: "grant-1" }),
    });
    expect(response.status).toBe(404);
    expect(prisma.couponGrant.findUnique).not.toHaveBeenCalled();
  });
});
