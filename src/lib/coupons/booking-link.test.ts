import { describe, expect, it } from "vitest";
import { buildPreappliedCouponUrl, buildTrackedCouponUrl, verifyCouponClickToken } from "./booking-link";

describe("buildPreappliedCouponUrl", () => {
  it("creates the reservation URL with the normalized coupon pre-applied", () => {
    expect(buildPreappliedCouponUrl(" volte10-abc 123 ", "https://pousadadelplata.com.br/admin"))
      .toBe("https://pousadadelplata.com.br/reservar?promo=VOLTE10-ABC123");
  });

  it("does not allow an unsafe configured protocol", () => {
    expect(buildPreappliedCouponUrl("VOLTE10-ABC123", "javascript:alert(1)"))
      .toBe("https://www.pousadadelplata.com.br/reservar?promo=VOLTE10-ABC123");
  });

  it("creates a signed tracking URL that can be verified", () => {
    process.env.ADMIN_JWT_SECRET = "test-secret";
    const tracked = new URL(buildTrackedCouponUrl("grant-1", "https://pousadadelplata.com.br"));
    expect(tracked.pathname).toBe("/api/coupons/grants/grant-1/click");
    expect(verifyCouponClickToken("grant-1", tracked.searchParams.get("token") || "")).toBe(true);
    expect(verifyCouponClickToken("grant-2", tracked.searchParams.get("token") || "")).toBe(false);
  });
});
